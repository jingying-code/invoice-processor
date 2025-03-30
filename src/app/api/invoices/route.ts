import { NextResponse } from 'next/server'

// 模拟数据
export const mockInvoices = [
  {
    id: '1',
    invoiceNumber: 'INV123456',
    type: '增值税专用发票',
    date: '2025-03-15',
    amount: 12500.00,
    vendor: '优质供应商A',
    status: 'approved',
  },
  {
    id: '2',
    invoiceNumber: 'INV123457',
    type: '增值税普通发票',
    date: '2025-03-10',
    amount: 8750.50,
    vendor: '普通供应商B',
    status: 'pending',
  },
  {
    id: '3',
    invoiceNumber: 'INV123458',
    type: '电子发票',
    date: '2025-03-05',
    amount: 3250.00,
    vendor: '优质供应商A',
    status: 'approved',
  },
]

export async function GET() {
  // TODO: 从数据库获取发票数据
  return NextResponse.json(mockInvoices)
}

export async function POST(request: Request) {
  try {
    const invoiceData = await request.json();
    
    // TODO: 将数据保存到数据库
    // 这里我们只是将新发票添加到模拟数据中
    mockInvoices.push(invoiceData);
    
    return NextResponse.json(invoiceData, { status: 201 });
  } catch (error) {
    console.error('Error saving invoice:', error);
    return NextResponse.json(
      { error: 'Failed to save invoice' },
      { status: 500 }
    );
  }
} 