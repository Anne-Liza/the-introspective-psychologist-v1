COMMON_WEAK_PASSWORDS = {
    "password",
    "password123",
    "changeme",
    "changeme123",
    "admin123",
    "qwerty123",
}


def validate_password_strength(password: str) -> str:
    if len(password) < 12:
        raise ValueError("Password must be at least 12 characters long.")

    if password.lower() in COMMON_WEAK_PASSWORDS:
        raise ValueError("Password is too common.")

    if not any(character.isalpha() for character in password):
        raise ValueError("Password must include at least one letter.")

    if not any(character.isdigit() for character in password):
        raise ValueError("Password must include at least one number.")

    return password
