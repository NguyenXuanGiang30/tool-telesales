from backend.gateway.simulators.run_soak import main


def test_soak_cli_returns_zero_for_success():
    assert main(["--devices", "2", "--iterations", "2", "--fail-rate", "0"]) == 0


def test_soak_cli_rejects_invalid_device_count():
    assert main(["--devices", "0", "--iterations", "1", "--fail-rate", "0"]) == 2


def test_soak_cli_rejects_invalid_iterations():
    assert main(["--devices", "2", "--iterations", "0", "--fail-rate", "0"]) == 2


def test_soak_cli_rejects_invalid_failure_rate():
    assert main(["--devices", "2", "--iterations", "1", "--fail-rate", "-1"]) == 2

