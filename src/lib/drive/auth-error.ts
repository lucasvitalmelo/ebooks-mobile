// desconectado: nunca conectou ou desconectou; reconectar: o Google recusou o
// login guardado; indisponivel: sem rede ou sem Google Play Services.
export type DriveAuthProblem = 'desconectado' | 'reconectar' | 'indisponivel'

export class DriveAuthError extends Error {
  readonly problem: DriveAuthProblem

  constructor(problem: DriveAuthProblem, message: string) {
    super(message)
    this.name = 'DriveAuthError'
    this.problem = problem
  }
}
