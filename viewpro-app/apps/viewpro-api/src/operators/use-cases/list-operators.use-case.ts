import { Inject, Injectable } from '@nestjs/common'
import { OPERATOR_REPOSITORY, type IOperatorRepository, type OperatorSummary } from '../../auth/repositories/operator.repository'

@Injectable()
export class ListOperatorsUseCase {
  constructor(@Inject(OPERATOR_REPOSITORY) private readonly operatorRepository: IOperatorRepository) {}

  execute(): Promise<OperatorSummary[]> {
    return this.operatorRepository.list()
  }
}
