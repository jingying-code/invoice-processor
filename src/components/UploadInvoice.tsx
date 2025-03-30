'use client'

import { useState } from 'react'
import { NextResponse } from 'next/server'
import { GoogleGenAI } from "@google/genai";

// Gemini API Key
const GEMINI_API_KEY = "AIzaSyCV4QRNHJVpCoMpIbBDSfZoep2_q8YDGzQ"
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

interface InvoiceData {
  invoiceNumber: string
  type: string
  date: string
  amount: number
  vendor: string
}

// 用于处理原始 API 响应的接口
interface RawInvoiceData {
  invoiceNumber: string
  type: string
  date: string
  amount: string | number
  vendor: string
}

export function UploadInvoice() {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<InvoiceData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0]
      const fileType = selectedFile.type
      
      // 检查文件类型
      if (!fileType.startsWith('image/') && fileType !== 'application/pdf') {
        setError('只支持图片和PDF文件')
        setFile(null)
        setResult(null)
        return
      }

      // 检查文件大小（限制为10MB）
      if (selectedFile.size > 10 * 1024 * 1024) {
        setError('文件大小不能超过10MB')
        setFile(null)
        setResult(null)
        return
      }

      setFile(selectedFile)
      setResult(null)
      setError(null)
    }
  }

  const handleUpload = async () => {
    if (!file) {
      setError('请选择文件')
      return
    }

    setUploading(true)
    setError(null)

    try {
      // 将文件转换为 base64
      const buffer = await file.arrayBuffer()
      const base64 = Buffer.from(buffer).toString('base64')

      // 准备文件数据
      const fileData = {
        inlineData: {
          data: base64,
          mimeType: file.type,
        },
      }
      console.log("fileData", fileData, file.type)

      // 根据文件类型选择不同的提示词
      const prompt = file.type === 'application/pdf'
        ? '请分析这个PDF文件中的发票信息，提取以下信息：发票号码、发票类型、开票日期、金额、供应商名称。请以JSON格式返回，键名分别为：invoiceNumber, type, date, amount, vendor'
        : '请提取这张发票图片的以下信息：发票号码、发票类型、开票日期、金额、供应商名称。请以JSON格式返回，键名分别为：invoiceNumber, type, date, amount, vendor'

      // 使用 Gemini 分析文件
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [prompt, fileData],
        config: {
          responseMimeType: 'application/json',
        },
      });

      // 解析 JSON 响应
      const responseText = response.text || '{}';
      console.log("API Response:", responseText);
      
      let rawInvoiceData;
      try {
        rawInvoiceData = JSON.parse(responseText);
      } catch (parseError) {
        console.error('JSON Parse Error:', parseError);
        throw new Error('无法解析发票数据，请确保文件格式正确');
      }
      console.log("rawInvoiceData", rawInvoiceData)
      // 如果rawInvoiceData是list，则取第一个
      if (Array.isArray(rawInvoiceData)) {
        rawInvoiceData = rawInvoiceData[0];
      }

      // 验证必要字段
      const requiredFields = ['invoiceNumber', 'type', 'date', 'amount', 'vendor'];
      const missingFields = requiredFields.filter(field => !rawInvoiceData[field]);
      if (missingFields.length > 0) {
        throw new Error(`缺少必要字段: ${missingFields.join(', ')}`);
      }

      // 转换数据类型
      const invoiceData = {
        invoiceNumber: String(rawInvoiceData.invoiceNumber),
        type: String(rawInvoiceData.type),
        date: String(rawInvoiceData.date),
        amount: parseFloat(rawInvoiceData.amount) || 0,
        vendor: String(rawInvoiceData.vendor),
      };
      
      // 保存发票数据到后端
      const saveResponse = await fetch('/api/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...invoiceData,
          id: Date.now().toString(),
          status: 'pending',
        }),
      });

      if (!saveResponse.ok) {
        const errorData = await saveResponse.json();
        throw new Error(errorData.error || '保存发票数据失败');
      }

      const savedData = await saveResponse.json();
      console.log("Saved Invoice Data:", savedData);
      setResult(invoiceData);
    } catch (error) {
      console.error('Upload error:', error)
      setError('处理文件失败，请重试')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center justify-center w-full">
        <label
          htmlFor="dropzone-file"
          className="flex flex-col items-center justify-center w-full h-64 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors duration-200"
        >
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <svg className="w-10 h-10 mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
            </svg>
            <p className="mb-2 text-sm text-gray-500">
              <span className="font-semibold">点击上传</span> 或拖拽文件到这里
            </p>
            <p className="text-xs text-gray-500">支持图片和PDF文件，大小不超过10MB</p>
          </div>
          <input
            id="dropzone-file"
            type="file"
            className="hidden"
            onChange={handleFileChange}
            accept="image/*,.pdf"
          />
        </label>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {file && (
        <div className="flex justify-center">
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors duration-200 flex items-center space-x-2"
          >
            {uploading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>处理中...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
                </svg>
                <span>开始处理</span>
              </>
            )}
          </button>
        </div>
      )}

      {result && (
        <div className="mt-6 p-6 bg-white rounded-lg shadow-md border border-gray-100">
          <h3 className="font-semibold text-lg mb-4 text-gray-800">发票信息</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-sm text-gray-500">发票号码</p>
              <p className="font-medium text-gray-900">{result.invoiceNumber}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-gray-500">发票类型</p>
              <p className="font-medium text-gray-900">{result.type}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-gray-500">开票日期</p>
              <p className="font-medium text-gray-900">{result.date}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-gray-500">发票金额</p>
              <p className="font-medium text-gray-900">
                ¥{typeof result.amount === 'number' 
                    ? result.amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    : '0.00'
                  }
              </p>
            </div>
            <div className="space-y-2 col-span-2">
              <p className="text-sm text-gray-500">供应商名称</p>
              <p className="font-medium text-gray-900">{result.vendor}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 