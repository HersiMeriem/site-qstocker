import { UnpaidInvoicesPipe } from './unpaid-invoices.pipe';

describe('UnpaidInvoicesPipe', () => {
  it('create an instance', () => {
    const pipe = new UnpaidInvoicesPipe();
    expect(pipe).toBeTruthy();
  });
});
