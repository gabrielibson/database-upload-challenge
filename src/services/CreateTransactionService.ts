// import AppError from '../errors/AppError';

import { getCustomRepository } from 'typeorm';
import Transaction from '../models/Transaction';
import AppError from '../errors/AppError';
import TransactionsRepository from '../repositories/TransactionsRepository';
import Category from '../models/Category';
import CategoriesRepository from '../repositories/CategoriesRepository';

class CreateTransactionService {
  public async execute({
    title,
    value,
    type,
    category,
  }: TransactionDTO): Promise<Transaction> {
    const transactionsRepository = getCustomRepository(TransactionsRepository);

    if (!['income', 'outcome'].includes(type)) {
      throw new AppError('Transaction type is invalid');
    }

    const { total } = await transactionsRepository.getBalance();

    if (type === 'outcome' && total < value) {
      throw new AppError('There is no cash enough to make this transaction');
    }

    const findCategory = await this.findCategory(category);

    const transaction = transactionsRepository.create({
      type,
      value,
      title,
      category: findCategory,
    });

    await transactionsRepository.save(transaction);

    return transaction;
  }

  private async findCategory(title: string): Promise<Category> {
    const categoriesRepository = getCustomRepository(CategoriesRepository);

    const findCategory = await categoriesRepository.findByTitle(title);

    if (!findCategory) {
      const createdCategory = categoriesRepository.create({
        title,
      });

      await categoriesRepository.save(createdCategory);
      return createdCategory;
    }
    return findCategory;
  }
}

export default CreateTransactionService;
