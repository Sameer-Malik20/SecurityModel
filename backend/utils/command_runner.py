import subprocess
import logging
import shlex
import os
import threading
from typing import Tuple

logger = logging.getLogger(__name__)

class CommandRunner:
    """
    Executes shell commands safely with timeouts and logging.
    """

    @staticmethod
    def run_command(command: list[str], cwd: str = None, timeout: int = 300, env: dict = None) -> Tuple[int, str, str]:
        """
        Runs a command as a subprocess.
        
        Args:
            command: List of command arguments.
            cwd: Working directory.
            timeout: Max execution time in seconds.
            env: Environment variables override.

        Returns:
            Tuple of (return_code, stdout, stderr)
        """
        if env is None:
            env = os.environ.copy()

        # Sanitize command for logging (redact secrets if any mechanism existed, here just string conversion)
        cmd_str = " ".join(shlex.quote(arg) for arg in command)
        logger.info(f"Executing: {cmd_str} in {cwd or '.'}")

        try:
            # shell=False is safer and default for list args
            result = subprocess.run(
                command,
                cwd=cwd,
                env=env,
                capture_output=True,
                text=True,
                timeout=timeout
            )
            return result.returncode, result.stdout, result.stderr
        except subprocess.TimeoutExpired:
            logger.error(f"Command timed out after {timeout}s: {cmd_str}")
            return -1, "", "Command timed out"
        except Exception as e:
            logger.exception(f"Failed to execute command: {cmd_str}")
            return -1, "", str(e)
