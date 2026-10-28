// SPDX-License-Identifier: GPL-3.0-or-later
// Browser representation adapter for dartchess 0.13.1's SquareSet API.
// Two unsigned 32-bit limbs preserve modulo-2^64 arithmetic in dart2js.
// The canonical attack/move-generation algorithms remain unchanged.
import './models.dart';

final class SquareSet {
  final int low, high;
  const SquareSet(int value) : low = value & 0xffffffff, high = 0;
  const SquareSet.fromHalves(int lo, int hi)
      : low = lo & 0xffffffff, high = hi & 0xffffffff;
  const SquareSet.fromSquare(Square square)
      : low = square < 32 ? (1 << square) & 0xffffffff : 0,
        high = square >= 32 ? (1 << (square - 32)) & 0xffffffff : 0;
  factory SquareSet.fromSquares(Iterable<Square> squares) =>
      squares.fold(empty, (set, square) => set.withSquare(square));
  const SquareSet.fromRank(Rank rank)
      : assert(rank >= 0 && rank < 8),
        low = rank < 4 ? (0xff << (8 * rank)) & 0xffffffff : 0,
        high = rank >= 4 ? (0xff << (8 * (rank - 4))) & 0xffffffff : 0;
  const SquareSet.fromFile(File file)
      : assert(file >= 0 && file < 8),
        low = (0x01010101 << file) & 0xffffffff,
        high = (0x01010101 << file) & 0xffffffff;
  const SquareSet.backrankOf(Side side)
      : low = side == Side.white ? 0xff : 0,
        high = side == Side.black ? 0xff000000 : 0;

  static const empty = SquareSet.fromHalves(0, 0);
  static const full = SquareSet.fromHalves(0xffffffff, 0xffffffff);
  static const lightSquares = SquareSet.fromHalves(0x55aa55aa, 0x55aa55aa);
  static const darkSquares = SquareSet.fromHalves(0xaa55aa55, 0xaa55aa55);
  static const diagonal = SquareSet.fromHalves(0x08040201, 0x80402010);
  static const antidiagonal = SquareSet.fromHalves(0x10204080, 0x01020408);
  static const corners = SquareSet.fromHalves(0x00000081, 0x81000000);
  static const center = SquareSet.fromHalves(0x18000000, 0x00000018);
  static const backranks = SquareSet.fromHalves(0x000000ff, 0xff000000);
  static const firstRank = SquareSet.fromHalves(0xff, 0);
  static const eighthRank = SquareSet.fromHalves(0, 0xff000000);
  static const aFile = SquareSet.fromHalves(0x01010101, 0x01010101);
  static const hFile = SquareSet.fromHalves(0x80808080, 0x80808080);

  SquareSet shr(int shift) {
    if (shift >= 64) return empty;
    if (shift <= 0) return this;
    if (shift >= 32) return SquareSet.fromHalves(high >>> (shift - 32), 0);
    return SquareSet.fromHalves((low >>> shift) | (high << (32 - shift)), high >>> shift);
  }
  SquareSet shl(int shift) {
    if (shift >= 64) return empty;
    if (shift <= 0) return this;
    if (shift >= 32) return SquareSet.fromHalves(0, low << (shift - 32));
    return SquareSet.fromHalves(low << shift, (high << shift) | (low >>> (32 - shift)));
  }
  SquareSet xor(SquareSet other) => SquareSet.fromHalves(low ^ other.low, high ^ other.high);
  SquareSet operator ^(SquareSet other) => xor(other);
  SquareSet union(SquareSet other) => SquareSet.fromHalves(low | other.low, high | other.high);
  SquareSet operator |(SquareSet other) => union(other);
  SquareSet intersect(SquareSet other) => SquareSet.fromHalves(low & other.low, high & other.high);
  SquareSet operator &(SquareSet other) => intersect(other);
  SquareSet minus(SquareSet other) => SquareSet.fromHalves(low - other.low, high - other.high - (low < other.low ? 1 : 0));
  SquareSet operator -(SquareSet other) => minus(other);
  SquareSet complement() => SquareSet.fromHalves(~low, ~high);
  SquareSet diff(SquareSet other) => SquareSet.fromHalves(low & ~other.low, high & ~other.high);
  SquareSet flipVertical() => SquareSet.fromHalves(_swapBytes(high), _swapBytes(low));
  SquareSet mirrorHorizontal() => SquareSet.fromHalves(_mirrorBytes(low), _mirrorBytes(high));
  int get size => _count(low) + _count(high);
  bool get isEmpty => low == 0 && high == 0;
  bool get isNotEmpty => !isEmpty;
  Square? get first => low != 0 ? Square(_trailingZeros(low)) : high != 0 ? Square(32 + _trailingZeros(high)) : null;
  Square? get last => high != 0 ? Square(31 + high.bitLength) : low != 0 ? Square(low.bitLength - 1) : null;
  Iterable<Square> get squares sync* {
    var rest = this;
    while (rest.isNotEmpty) { final square = rest.first!; yield square; rest = rest.withoutSquare(square); }
  }
  Iterable<Square> get squaresReversed sync* {
    var rest = this;
    while (rest.isNotEmpty) { final square = rest.last!; yield square; rest = rest.withoutSquare(square); }
  }
  bool get moreThanOne => low != 0 && high != 0 || (low & (low - 1)) != 0 || (high & (high - 1)) != 0;
  Square? get singleSquare => moreThanOne ? null : last;
  bool has(Square square) => square < 32 ? (low & (1 << square)) != 0 : (high & (1 << (square - 32))) != 0;
  bool isIntersected(SquareSet other) => (low & other.low) != 0 || (high & other.high) != 0;
  bool isDisjoint(SquareSet other) => !isIntersected(other);
  SquareSet withSquare(Square square) => union(SquareSet.fromSquare(square));
  SquareSet withoutSquare(Square square) => diff(SquareSet.fromSquare(square));
  SquareSet toggleSquare(Square square) => xor(SquareSet.fromSquare(square));
  SquareSet withoutFirst() => first == null ? empty : withoutSquare(first!);
  String toHexString() => isEmpty ? '0' : '0x${high.toRadixString(16).padLeft(8, '0')}${low.toRadixString(16).padLeft(8, '0')}'.toUpperCase().replaceFirst('0X', '0x');
  @override
  bool operator ==(Object other) => other is SquareSet && low == other.low && high == other.high;
  @override
  int get hashCode => Object.hash(low, high);
}

int _swapBytes(int x) => ((x & 0xff) << 24) | ((x & 0xff00) << 8) | ((x >>> 8) & 0xff00) | (x >>> 24);
int _mirrorBytes(int x) {
  x = ((x >>> 1) & 0x55555555) | ((x & 0x55555555) << 1);
  x = ((x >>> 2) & 0x33333333) | ((x & 0x33333333) << 2);
  return ((x >>> 4) & 0x0f0f0f0f) | ((x & 0x0f0f0f0f) << 4);
}
int _count(int x) {
  x = x - ((x >>> 1) & 0x55555555);
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  x = (x + (x >>> 4)) & 0x0f0f0f0f;
  x += x >>> 8; x += x >>> 16;
  return x & 0x3f;
}
int _trailingZeros(int x) {
  var count = 0;
  while ((x & 1) == 0) { x = x >>> 1; count++; }
  return count;
}
