export function createAccountController({ accountService }) {
  return {
    async removeCurrent(req, res, next) {
      try {
        await accountService.removeCurrent({
          userId: req.auth.userId,
          password: req.body?.password,
        });
        res.status(204).end();
      } catch (error) {
        next(error);
      }
    },
  };
}
