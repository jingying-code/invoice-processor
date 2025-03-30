import { Tabs } from '@/components/Tabs'
import { UploadInvoice } from '@/components/UploadInvoice'
import { InvoiceList } from '@/components/InvoiceList'

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl font-bold text-gray-900">智能票据处理工厂</h1>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <Tabs
            tabs={[
              {
                label: '上传票据',
                content: <UploadInvoice />
              },
              {
                label: '票据列表',
                content: <InvoiceList />
              }
            ]}
          />
        </div>
      </main>
    </div>
  )
} 