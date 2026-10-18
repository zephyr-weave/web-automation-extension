#!/usr/bin/env python3
"""生成后台保活用的全静音 WAV data URI。

原理：Chrome 对后台/最小化标签页的计时器有 intensive throttling（隐藏约 5 分钟后
限制为每分钟 1 次），导致网页自动化的 sleep/轮询停滞。让标签页保持"有声"状态可
豁免该节流——循环播放一路数字静音即可，无可听输出。

用法：
    python make_silent_wav.py            # 打印 data URI
    python make_silent_wav.py --seconds 1 --rate 8000   # 自定义时长/采样率

产物用法（JS）：
    const SILENT_WAV = '<上面打印的 data URI>';
    const audio = new Audio(SILENT_WAV);
    audio.loop = true;
    audio.style.cssText = 'position:fixed;left:-9999px;width:1px;height:1px;opacity:0';
    document.body.appendChild(audio);
    audio.play();  // 必须在用户手势（如"开始"点击）的同步上下文里调用
"""
import argparse
import base64
import struct
import sys


def make_silent_wav(seconds: float = 0.1, rate: int = 8000) -> bytes:
    """生成 8bit 单声道全静音 WAV（无任何可听输出）。

    8bit PCM 为无符号编码，静音电平是 128（0x80）；用 0x00 会引入直流偏置，
    可能在循环接缝处产生爆音，故统一填充 0x80。
    """
    n_samples = int(seconds * rate)
    data = b"\x80" * n_samples  # 128 = 8bit 无符号 PCM 的静音电平
    byte_rate = rate * 1  # 8bit 单声道
    header = b"RIFF"
    header += struct.pack("<I", 36 + len(data))
    header += b"WAVE"
    header += b"fmt "
    header += struct.pack("<IHHIIHH", 16, 1, 1, rate, byte_rate, 1, 8)
    header += b"data"
    header += struct.pack("<I", len(data))
    return header + data


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate a silent WAV data URI for background keep-alive")
    parser.add_argument("--seconds", type=float, default=0.1, help="duration in seconds (default 0.1)")
    parser.add_argument("--rate", type=int, default=8000, help="sample rate in Hz (default 8000)")
    args = parser.parse_args()

    wav = make_silent_wav(args.seconds, args.rate)
    uri = "data:audio/wav;base64," + base64.b64encode(wav).decode("ascii")
    print(uri)
    print(f"# {len(wav)} bytes, {args.seconds}s @ {args.rate}Hz 8-bit mono, silent", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
