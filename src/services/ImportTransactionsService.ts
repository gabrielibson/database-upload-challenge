import path from 'path';
import fs from 'fs';
import csvParse from 'csv-parse';
import { getRepository, In } from 'typeorm';
import Transaction from '../models/Transaction';
import uploadConfig from '../config/upload';
import Category from '../models/Category';

interface Request {
  file_name: string;
}

async function loadCSV(filePath: string): Promise<TransactionDTO[]> {
  const readCSVStream = fs.createReadStream(filePath);

  const parseStream = csvParse({
    from_line: 2,
    ltrim: true,
    rtrim: true,
  });
  const transactions: TransactionDTO[] = [];

  const parseCSV = readCSVStream.pipe(parseStream);

  parseCSV.on('data', async line => {
    const [title, type, value, category] = line.map((cell: string) =>
      cell.trim(),
    );

    if (!title || !type || !value || !category) return;

    const transaction: TransactionDTO = { title, type, value, category };

    transactions.push(transaction);
  });

  await new Promise(resolve => {
    parseCSV.on('end', resolve);
  });

  return transactions;
}

class ImportTransactionsService {
  async execute({ file_name }: Request): Promise<Transaction[]> {
    const csvFilePath = path.resolve(uploadConfig.directory, file_name);

    const transactions = await loadCSV(csvFilePath);

    const categories: string[] = transactions.map(
      transaction => transaction.category,
    );

    const categoriesRepository = getRepository(Category);

    const existentCategories = await categoriesRepository.find({
      where: {
        title: In(categories),
      },
    });

    const existentCategoriesTitles = existentCategories.map(
      category => category.title,
    );

    const addCategoriesTitles = categories
      .filter(category => !existentCategoriesTitles.includes(category))
      .filter((value, index, self) => self.indexOf(value) === index);

    const newCategories = categoriesRepository.create(
      addCategoriesTitles.map(title => ({
        title,
      })),
    );

    await categoriesRepository.save(newCategories);

    const finalCategories = [...newCategories, ...existentCategories];

    const transactionsRepository = getRepository(Transaction);

    const createdTransactions = transactionsRepository.create(
      transactions.map(transaction => ({
        title: transaction.title,
        type: transaction.type,
        value: transaction.value,
        category: finalCategories.find(
          category => category.title === transaction.category,
        ),
      })),
    );

    await transactionsRepository.save(createdTransactions);

    await fs.promises.unlink(csvFilePath);

    return createdTransactions;
  }
}

export default ImportTransactionsService;
