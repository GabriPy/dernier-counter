/**
 * Converte un parametro di route in intero positivo.
 * Lancia un errore 400 se il valore non è un ID valido.
 */
import { HttpError } from './httpError';

export function parseId(value: string | undefined, label = 'ID'): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new HttpError(400, `${label} non valido`);
  }
  return id;
}
