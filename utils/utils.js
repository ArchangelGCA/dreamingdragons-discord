export function parseColorHex(colorInput) {
    if (!colorInput) return null;

    // Remove # if present
    if (colorInput.startsWith('#')) {
        colorInput = colorInput.slice(1);
    }

    // Check if valid hex color (3 or 6 digits)
    if (/^[0-9A-Fa-f]{6}$/.test(colorInput) || /^[0-9A-Fa-f]{3}$/.test(colorInput)) {
        // Convert 3-digit hex to 6-digit
        if (colorInput.length === 3) {
            colorInput = colorInput[0] + colorInput[0] + colorInput[1] + colorInput[1] + colorInput[2] + colorInput[2];
        }
        return parseInt(colorInput, 16);
    }

    return null;
}