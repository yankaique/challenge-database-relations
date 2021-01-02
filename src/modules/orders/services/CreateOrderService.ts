import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('Customer is not found.');
    }

    const verifiedProduct = await this.productsRepository.findAllById(products);

    if (!verifiedProduct.length) {
      throw new AppError('Product is not found.');
    }

    const verifiedProductId = verifiedProduct.map(product => product.id);

    const checkProductId = products.filter(
      product => !verifiedProductId.includes(product.id),
    );

    if (checkProductId.length) {
      throw new AppError('Could not find product');
    }

    const findProductWithNoQuantityAvailable = products.filter(
      product =>
        verifiedProduct.filter(p => p.id === product.id)[0].quantity <
        product.quantity,
    );

    if (findProductWithNoQuantityAvailable.length) {
      throw new AppError('The quantity is not available');
    }

    const serializedProducts = products.map(product => ({
      product_id: product.id,
      quantity: product.quantity,
      price: verifiedProduct.filter(p => p.id === product.id)[0].price,
    }));

    const order = await this.ordersRepository.create({
      customer,
      products: serializedProducts,
    });

    const orderedProductQuantity = products.map(product => ({
      id: product.id,
      quantity:
        verifiedProduct.filter(p => p.id === product.id)[0].quantity -
        product.quantity,
    }));

    await this.productsRepository.updateQuantity(orderedProductQuantity);

    return order;
  }
}

export default CreateOrderService;
