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

interface UploadProgress {
  [key: string]: {
    status: 'pending' | 'processing' | 'success' | 'error'
    progress: number
    error?: string
    result?: InvoiceData
  }
}

export function UploadInvoice() {
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({})
  const [error, setError] = useState<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files)
      const validFiles: File[] = []
      const errors: string[] = []

      selectedFiles.forEach(file => {
        const fileType = file.type
        
        // 检查文件类型
        if (!fileType.startsWith('image/') && fileType !== 'application/pdf') {
          errors.push(`${file.name}: 不支持的文件类型`)
          return
        }

        // 检查文件大小（限制为10MB）
        if (file.size > 10 * 1024 * 1024) {
          errors.push(`${file.name}: 文件大小超过10MB`)
          return
        }

        validFiles.push(file)
      })

      if (errors.length > 0) {
        setError(errors.join('\n'))
      } else {
        setError(null)
      }

      setFiles(validFiles)
      
      // 初始化上传进度
      const initialProgress: UploadProgress = {}
      validFiles.forEach(file => {
        initialProgress[file.name] = {
          status: 'pending',
          progress: 0
        }
      })
      setUploadProgress(initialProgress)
    }
  }

  const processFile = async (file: File) => {
    try {
      // 更新状态为处理中
      setUploadProgress(prev => ({
        ...prev,
        [file.name]: { ...prev[file.name], status: 'processing', progress: 0 }
      }))

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
      let rawInvoiceData;
      try {
        rawInvoiceData = JSON.parse(responseText);
      } catch (parseError) {
        throw new Error('无法解析发票数据，请确保文件格式正确');
      }

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
      
      // 更新状态为成功
      setUploadProgress(prev => ({
        ...prev,
        [file.name]: { 
          ...prev[file.name], 
          status: 'success', 
          progress: 100,
          result: invoiceData
        }
      }))

      return invoiceData;
    } catch (error) {
      // 更新状态为错误
      setUploadProgress(prev => ({
        ...prev,
        [file.name]: { 
          ...prev[file.name], 
          status: 'error', 
          progress: 0,
          error: error instanceof Error ? error.message : '处理失败'
        }
      }))
      throw error;
    }
  }

  const handleUpload = async () => {
    if (files.length === 0) {
      setError('请选择文件')
      return
    }

    setUploading(true)
    setError(null)

    try {
      // 并行处理所有文件
      await Promise.all(files.map(file => processFile(file)))
    } catch (error) {
      console.error('Upload error:', error)
      setError('部分文件处理失败，请重试')
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
            multiple
          />
        </label>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600 whitespace-pre-line">{error}</p>
        </div>
      )}

      {files.length > 0 && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-600">已选择 {files.length} 个文件</p>
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

          <div className="space-y-2">
            {files.map((file) => (
              <div key={file.name} className="bg-white p-4 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                    </svg>
                    <span className="text-sm font-medium text-gray-700">{file.name}</span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </span>
                </div>
                
                {uploadProgress[file.name] && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>
                        {uploadProgress[file.name].status === 'pending' && '等待处理'}
                        {uploadProgress[file.name].status === 'processing' && '处理中...'}
                        {uploadProgress[file.name].status === 'success' && '处理成功'}
                        {uploadProgress[file.name].status === 'error' && '处理失败'}
                      </span>
                      <span>{uploadProgress[file.name].progress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${
                          uploadProgress[file.name].status === 'success' ? 'bg-green-500' :
                          uploadProgress[file.name].status === 'error' ? 'bg-red-500' :
                          'bg-blue-500'
                        }`}
                        style={{ width: `${uploadProgress[file.name].progress}%` }}
                      />
                    </div>
                    {uploadProgress[file.name].error && (
                      <p className="text-xs text-red-500">{uploadProgress[file.name].error}</p>
                    )}
                    {uploadProgress[file.name].result && (
                      <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                        <p className="font-medium">发票号码: {uploadProgress[file.name].result.invoiceNumber}</p>
                        <p>类型: {uploadProgress[file.name].result.type}</p>
                        <p>金额: ¥{uploadProgress[file.name].result.amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
} 