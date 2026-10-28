// Run unchanged against upstream int64 and the compiled-JS paired representation.
import 'dart:convert';
import 'package:dartchess/dartchess.dart';

int digest = 0, bitboardChecks = 0, moveChecks = 0, nodesChecked = 0;
void record(Object? value) {
  for (final c in '$value'.codeUnits) { digest = (digest * 31 + c) & 0xffffffff; }
}
void check(bool condition, String message) {
  if (!condition) throw StateError(message);
}
SquareSet bits(int lo, int hi) => SquareSet.fromSquares([
  for (var i = 0; i < 32; i++) if ((lo & (1 << i)) != 0) Square(i),
  for (var i = 0; i < 32; i++) if ((hi & (1 << i)) != 0) Square(32 + i),
]);
final mask = (BigInt.one << 64) - BigInt.one;
BigInt number(SquareSet set) => set.isEmpty ? BigInt.zero : BigInt.parse(set.toHexString().substring(2), radix:16);
void equals(SquareSet actual, BigInt expected, String context) {
  expected &= mask;
  check(number(actual) == expected, '$context: ${actual.toHexString()} != $expected');
  final squares = [for (var i=0; i<64; i++) if ((expected & (BigInt.one << i)) != BigInt.zero) i];
  check(actual.squares.map((s)=>s.value).join(',') == squares.join(','), '$context iteration');
  check(actual.squaresReversed.map((s)=>s.value).join(',') == squares.reversed.join(','), '$context reversed');
  check(actual.size == squares.length && actual.isEmpty == squares.isEmpty, '$context size');
  check(actual.first == (squares.isEmpty ? null : Square(squares.first)), '$context first');
  check(actual.last == (squares.isEmpty ? null : Square(squares.last)), '$context last');
  check(actual.moreThanOne == (squares.length > 1), '$context moreThanOne');
  check(actual.singleSquare == (squares.length == 1 ? Square(squares.single) : null), '$context single');
  record(actual.toHexString()); bitboardChecks++;
}
int seed=0x19641971;
int random32() { seed=(seed ^ (seed << 13)) & 0xffffffff; seed=(seed ^ (seed >>> 17)) & 0xffffffff; seed=(seed ^ (seed << 5)) & 0xffffffff; return seed; }

void main() {
  for (final set in [SquareSet.empty,SquareSet.full,SquareSet.lightSquares,SquareSet.darkSquares,SquareSet.diagonal,SquareSet.antidiagonal,SquareSet.corners,SquareSet.center,SquareSet.backranks,SquareSet.firstRank,SquareSet.eighthRank,SquareSet.aFile,SquareSet.hFile]) {
    record(set.toHexString());
  }
  for (var square=0; square<64; square++) {
    final single = SquareSet.fromSquare(Square(square));
    equals(single,BigInt.one<<square,'singleton $square');
    check({single}.contains(bits(square<32 ? 1<<square : 0, square>=32 ? 1<<(square-32) : 0)), 'value equality/hash $square');
    record(SquareSet.fromRank(Square(square).rank).toHexString());
    record(SquareSet.fromFile(Square(square).file).toHexString());
  }
  for (var iteration=0;iteration<512;iteration++) {
    final a=bits(random32(),random32()), b=bits(random32(),random32());
    final x=number(a),y=number(b);
    equals(a|b,x|y,'union'); equals(a&b,x&y,'intersection'); equals(a^b,x^y,'xor');
    equals(a-b,x-y,'subtract/borrow'); equals(a.complement(),~x,'complement'); equals(a.diff(b),x & ~y,'difference');
    check(a.isIntersected(b) == ((x&y)!=BigInt.zero) && a.isDisjoint(b) == ((x&y)==BigInt.zero),'intersection predicates');
    for (final shift in [-1,0,1,7,8,16,31,32,33,56,63,64,65]) {
      equals(a.shl(shift),shift<=0 ? x : x<<shift,'left $shift');
      equals(a.shr(shift),shift<=0 ? x : x>>shift,'right $shift');
    }
    var flipped=BigInt.zero,mirrored=BigInt.zero;
    for (var square=0;square<64;square++) if ((x & (BigInt.one<<square))!=BigInt.zero) {
      flipped |= BigInt.one << (square^56); mirrored |= BigInt.one << (square^7);
    }
    equals(a.flipVertical(),flipped,'vertical'); equals(a.mirrorHorizontal(),mirrored,'horizontal');
    final square=Square(iteration%64), bit=BigInt.one<<square;
    equals(a.withSquare(square),x|bit,'with square'); equals(a.withoutSquare(square),x & ~bit,'without square'); equals(a.toggleSquare(square),x^bit,'toggle');
  }
  final fixtures=jsonDecode(__PERFT_FIXTURES__) as List<dynamic>;
  check(perft(Chess.initial,4)==197281,'initial perft4'); nodesChecked+=197281;
  for (final fixture in fixtures) {
    final position=Chess.fromSetup(Setup.parseFen(fixture['fen'] as String));
    check(Chess.fromSetup(Setup.parseFen(position.fen)).fen==position.fen,'FEN roundtrip');
    for (final testCase in fixture['cases']) {
      final nodes=perft(position,testCase[0] as int);
      check(nodes==testCase[1],'${fixture['id']} depth ${testCase[0]}: $nodes != ${testCase[1]}');
      record(nodes); nodesChecked+=nodes;
    }
    final moves=position.legalMoves.entries.expand((entry)=>entry.value.squares.map((to)=>'${entry.key.name}${to.name}')).toList()..sort();
    record(position.fen);record(moves.join(','));moveChecks+=moves.length;
  }
  // Deterministic full games compare move ordering, SAN parsing, play, terminal
  // detection and FEN at each ply against the untouched native implementation.
  for (var game=0;game<12;game++) {
    Position position=Chess.initial;
    for (var ply=0;ply<160;ply++) {
      final moves=<Move>[];
      for (final entry in position.legalMoves.entries) {
        for (final to in entry.value.squares) {
          final promotion=position.board.pieceAt(entry.key)?.role==Role.pawn && (to.rank==0 || to.rank==7);
          for (final role in promotion ? [Role.queen,Role.rook,Role.bishop,Role.knight] : <Role?>[null]) {
            moves.add(NormalMove(from:entry.key,to:to,promotion:role));
          }
        }
      }
      if(moves.isEmpty) break;
      final move=moves[random32()%moves.length];
      final san=position.makeSan(move).$2;
      check(position.parseSan(san)==move,'SAN roundtrip $san');
      position=position.play(move); record(san);record(position.fen);moveChecks++;
    }
  }
  print(jsonEncode({'digest':digest,'bitboardChecks':bitboardChecks,'moveChecks':moveChecks,'perftNodes':nodesChecked,'perftPositions':fixtures.length+1}));
}
