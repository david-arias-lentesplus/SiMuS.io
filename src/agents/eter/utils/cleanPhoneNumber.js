// Éter — limpieza de números de teléfono del CSV de Workingbits.
//
// Heurística (ver "Pendiente de definir" en .claude/agents/eter.md: no
// verificada contra un CSV real de Workingbits):
//   1. Se descartan todos los caracteres que no sean dígitos (espacios,
//      guiones, paréntesis, "+").
//   2. Si el número resultante empieza con el indicativo del país
//      elegido Y le sobran más dígitos de los que tendría un número local
//      típico (>= 8 dígitos después de quitar el indicativo), se quita el
//      indicativo. Este segundo chequeo evita quitarle por error los
//      primeros dígitos a un número que YA viene sin indicativo pero que,
//      por coincidencia, empieza con esos mismos dígitos (ej. un celular
//      colombiano que empezara con "57...").
//   3. Si no aplica el punto 2, se devuelve el número solo con los
//      dígitos ya extraídos (sin indicativo asumido).
//
// @param {string} rawPhone Valor crudo de la columna `To` del CSV.
// @param {string|null} dialCode Indicativo del país elegido (ver countryDialCodes.js).
// @returns {string} Número limpio (solo dígitos, sin indicativo cuando se pudo determinar).
const MIN_LOCAL_DIGITS_AFTER_STRIP = 8;

export function cleanPhoneNumber(rawPhone, dialCode) {
  const digitsOnly = String(rawPhone ?? '').replace(/\D/g, '');
  if (!digitsOnly) return '';
  if (!dialCode) return digitsOnly;

  if (digitsOnly.startsWith(dialCode)) {
    const withoutDialCode = digitsOnly.slice(dialCode.length);
    if (withoutDialCode.length >= MIN_LOCAL_DIGITS_AFTER_STRIP) {
      return withoutDialCode;
    }
  }
  return digitsOnly;
}
