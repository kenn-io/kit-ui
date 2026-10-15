#!/usr/bin/env python3
"""Sample a macOS process externally, without causing application redraws."""

import argparse
import csv
import ctypes
import math
import os
import sys
import time


# rusage_info_v0 from the macOS SDK's sys/resource.h, RUSAGE_INFO_V0 = 0.
class Usage(ctypes.Structure):
    _fields_ = [("uuid", ctypes.c_uint8 * 16)] + [
        (name, ctypes.c_uint64)
        for name in (
            "user_time", "system_time", "idle_wakeups", "interrupt_wakeups",
            "pageins", "wired_size", "resident_size", "phys_footprint",
            "start_time", "exit_time",
        )
    ]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pid", type=int, help="PID of the process to observe")
    parser.add_argument("--interval", type=float, default=1, help="Seconds between samples")
    parser.add_argument("--duration", type=float, default=0, help="Seconds to observe; 0 waits for Ctrl-C or process exit")
    args = parser.parse_args()
    if sys.platform != "darwin":
        parser.error("This observer requires macOS")
    if args.pid <= 0 or not math.isfinite(args.interval) or args.interval <= 0 or not math.isfinite(args.duration) or args.duration < 0:
        parser.error("PID and interval must be positive; duration must be nonnegative")

    lib = ctypes.CDLL("/usr/lib/libproc.dylib", use_errno=True)
    lib.proc_pid_rusage.argtypes = [ctypes.c_int, ctypes.c_int, ctypes.c_void_p]
    lib.proc_pid_rusage.restype = ctypes.c_int
    lib.proc_pidpath.argtypes = [ctypes.c_int, ctypes.c_void_p, ctypes.c_uint32]
    lib.proc_pidpath.restype = ctypes.c_int
    path = ctypes.create_string_buffer(4096)
    if lib.proc_pidpath(args.pid, path, len(path)) > 0:
        executable = os.fsdecode(path.value)
        print(f"PID {args.pid}: {executable}", file=sys.stderr)
        try:
            print(f"Executable: {os.stat(executable).st_size} bytes (excludes external assets)", file=sys.stderr)
        except OSError:
            pass

    writer = csv.writer(sys.stdout)
    writer.writerow(["elapsed_s", "pid", "resident_bytes", "physical_footprint_bytes"])
    started = time.monotonic()
    identity = None
    while True:
        usage = Usage()
        if lib.proc_pid_rusage(args.pid, 0, ctypes.byref(usage)) != 0:
            error = ctypes.get_errno()
            print(f"Sampling stopped: {os.strerror(error)}", file=sys.stderr)
            return 1 if identity is None else 0
        if identity is None:
            identity = usage.start_time
        if usage.start_time != identity or usage.exit_time:
            print("Sampling stopped: original process exited", file=sys.stderr)
            return 0
        elapsed = time.monotonic() - started
        writer.writerow([f"{elapsed:.3f}", args.pid, usage.resident_size, usage.phys_footprint])
        sys.stdout.flush()
        if args.duration and elapsed >= args.duration:
            return 0
        delay = min(args.interval, args.duration - elapsed) if args.duration else args.interval
        time.sleep(max(0, delay))


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        pass
