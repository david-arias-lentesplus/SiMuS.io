// Minerva — intenta convertir el valor crudo de `Send At` (columna del
// CSV de Workingbits, formato no verificado contra un archivo real, ver
// "Pendiente de definir" en .claude/agents/eter.md) al formato
// 'YYYY-MM-DD' que espera el <input type="date"> de la Calculadora.
//
// Estrategia, en orden:
//   1. Si ya empieza con YYYY-MM-DD (ISO), se toman esos 10 caracteres.
//   2. Si no, se delega a `new Date(raw)` (cubre formatos comunes tipo
//      "MM/DD/YYYY HH:mm" o "MM/DD/YYYY") y se formatea en UTC.
//   3. Si nada de lo anterior produce una fecha válida, se devuelve ''
//      — el usuario completa la fecha a mano; no se adivina un valor
//      incorrecto solo por completar el campo.
export function parseCsvDate(raw) {
  const value = String(raw ?? '').trim();
  if (!value) return '';

  const isoMatch = value.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return '';
}
