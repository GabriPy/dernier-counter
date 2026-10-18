import type { NextFunction, Request, Response } from 'express';

/**
 * Express 4 non intercetta le promise rifiutate: questo wrapper inoltra
 * ogni errore al middleware centralizzato di gestione errori.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}
