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
  try {
    return NextResponse.json(mockInvoices)
  } catch (error) {
    console.error('Error fetching invoices:', error)
    return NextResponse.json(
      { error: '获取发票列表失败' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const invoiceData = await request.json()
    
    // 验证必要字段
    const requiredFields = ['invoiceNumber', 'type', 'date', 'amount', 'vendor']
    const missingFields = requiredFields.filter(field => !invoiceData[field])
    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: `缺少必要字段: ${missingFields.join(', ')}` },
        { status: 400 }
      )
    }

    // 验证数据类型
    if (typeof invoiceData.amount !== 'number') {
      return NextResponse.json(
        { error: '金额必须是数字类型' },
        { status: 400 }
      )
    }

    // 检查发票号是否已存在
    const existingInvoice = mockInvoices.find(
      inv => inv.invoiceNumber === invoiceData.invoiceNumber
    )
    if (existingInvoice) {
      return NextResponse.json(
        { error: '发票号已存在' },
        { status: 400 }
      )
    }

    // 创建新发票
    const newInvoice = {
      ...invoiceData,
      id: Date.now().toString(),
      status: 'pending',
    }

    // 添加到模拟数据中
    mockInvoices.push(newInvoice)
    
    return NextResponse.json(newInvoice, { status: 201 })
  } catch (error) {
    console.error('Error saving invoice:', error)
    return NextResponse.json(
      { error: '保存发票失败' },
      { status: 500 }
    )
  }
} 