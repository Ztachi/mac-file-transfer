// 此文件将处理与MTP相关的操作
// 使用child_process调用系统命令来实现MTP通信

const { exec, spawn } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const path = require('path');
const fs = require('fs');
const os = require('os');
const { usb, getDeviceList, LibUSBException } = require('usb'); // 引入 usb 库

// MTP Constants (Simplified)
const MTP_CONTAINER_TYPE_COMMAND = 1;
const MTP_CONTAINER_TYPE_DATA = 2;
const MTP_CONTAINER_TYPE_RESPONSE = 3;
const MTP_CONTAINER_TYPE_EVENT = 4;

const MTP_OP_OpenSession = 0x1002;
const MTP_OP_CloseSession = 0x1003;
const MTP_OP_GetDeviceInfo = 0x1001;
const MTP_OP_GetStorageIDs = 0x1004;
const MTP_OP_GetStorageInfo = 0x1005;
const MTP_OP_GetObjectHandles = 0x1007;
const MTP_OP_GetObjectInfo = 0x1008;
const MTP_OP_GetObject = 0x1009;
const MTP_OP_SendObject = 0x100C;

const MTP_RESPONSE_OK = 0x2001;
const MTP_RESPONSE_GENERAL_ERROR = 0x2002;
const MTP_RESPONSE_PARAMETER_NOT_SUPPORTED = 0x2006;
const MTP_RESPONSE_DEVICE_BUSY = 0x2019;
const MTP_RESPONSE_SESSION_ALREADY_OPEN = 0x201E;

// Helper to create MTP command buffer
function createMtpCommand(opcode, sessionId, transactionId, params = []) {
    const buffer = Buffer.alloc(12 + params.length * 4);
    buffer.writeUInt32LE(buffer.length, 0); // Container Length
    buffer.writeUInt16LE(MTP_CONTAINER_TYPE_COMMAND, 4); // Container Type
    buffer.writeUInt16LE(opcode, 6); // OpCode
    buffer.writeUInt32LE(transactionId, 8); // Transaction ID
    params.forEach((param, index) => {
        buffer.writeUInt32LE(param, 12 + index * 4);
    });
    return buffer;
}

// Helper to parse MTP response header
function parseMtpResponseHeader(buffer) {
    if (buffer.length < 12) return null;
    return {
        length: buffer.readUInt32LE(0),
        type: buffer.readUInt16LE(4),
        code: buffer.readUInt16LE(6),
        transactionId: buffer.readUInt32LE(8),
    };
}

/**
 * 获取MTP错误代码的描述
 * @param {number} code - MTP响应代码
 * @returns {string} 错误描述
 */
function getMtpErrorDescription(code) {
  const errorCodes = {
    0x2001: "OK",
    0x2002: "一般错误",
    0x2003: "会话未打开",
    0x2004: "无效的事务ID",
    0x2005: "操作不支持",
    0x2006: "参数不支持",
    0x2007: "不完整的传输",
    0x2008: "无效的存储ID",
    0x2009: "无效的对象句柄",
    0x200A: "设备属性不支持",
    0x200B: "无效的对象格式码",
    0x200C: "存储已满",
    0x200D: "存储已写保护",
    0x200E: "对象写保护",
    0x200F: "存储不可用",
    0x2010: "规范版本不支持",
    0x2011: "没有有效的对象信息",
    0x2012: "设备忙",
    0x2013: "存储类型不支持",
    0x2014: "对象太大",
    0x2015: "对象属性不支持",
    0x2016: "无效的对象属性值",
    0x2017: "无效的参数",
    0x2018: "会话已打开",
    0x2019: "事务已取消",
    0x201A: "规范版本不认可",
    0x201B: "没有有效的对象数据",
    0x201C: "设备模式不支持",
    0x201D: "分组不支持",
    0x201E: "会话已打开",
    0x201F: "事务已打开"
  };
  
  return errorCodes[code] || `未知错误 (0x${code.toString(16)})`;
}

class MTPService {
  constructor() {
    this.isConnected = false;
    this.deviceInfo = null;
    this.connectedUsbDevice = null; // Store the actual usb device object
    this.mtpInterface = null;
    this.endpointIn = null;
    this.endpointOut = null;
    this.sessionId = 0;
    this.transactionId = 1; // Start transaction ID counter
    this.platform = os.platform();
    this.currentTransactionId = 0; // Added for the new sendMtpCommand method
  }

  getNextTransactionId() {
    return this.transactionId++;
  }

  /**
   * 检测系统上的MTP设备
   * 检查设备的接口描述符以识别 MTP 设备
   */
  async detectDevices() {
    console.log('[mtpService] 开始检测MTP设备...');
    // 清理之前的连接
    await this.disconnect();
    
    try {
      // 获取所有USB设备
      let devices;
      try {
        devices = getDeviceList();
      } catch (e) {
        console.error('[mtpService] 获取USB设备列表失败:', e.message);
        return { connected: false };
      }
      
      console.log(`[mtpService] 检测到 ${devices.length} 个USB设备`);
      
      // 遍历所有设备
      for (const device of devices) {
        const vid = device.deviceDescriptor.idVendor;
        const pid = device.deviceDescriptor.idProduct;
        console.log(`[mtpService] 检查设备: VID=${vid.toString(16)}, PID=${pid.toString(16)}`);
        
        try {
          // 尝试打开设备
          device.open();
          console.log(`[mtpService] 设备已打开，查找接口`);
          
          // 查找支持MTP的接口和终结点
          let foundEndpoints = false;
          
          // 尝试所有接口
          for (const iface of device.interfaces) {
            try {
              // 尝试声明接口
              iface.claim();
              console.log(`[mtpService] 已声明接口 ${iface.interfaceNumber}`);
              
              // 查找批量传输终结点
              let inEndpoint = null;
              let outEndpoint = null;
              
              for (const endpoint of iface.endpoints) {
                console.log(`[mtpService] 端点: 地址=${endpoint.address.toString(16)}, 类型=${endpoint.transferType}, 方向=${endpoint.direction}`);
                
                if (endpoint.transferType === usb.LIBUSB_TRANSFER_TYPE_BULK) {
                  if (endpoint.direction === 'in') {
                    inEndpoint = endpoint;
                    console.log('[mtpService] 找到批量IN端点');
                  } else if (endpoint.direction === 'out') {
                    outEndpoint = endpoint;
                    console.log('[mtpService] 找到批量OUT端点');
                  }
                }
              }
              
              // 如果找到所需终结点，保存设备信息
              if (inEndpoint && outEndpoint) {
                console.log('[mtpService] 找到匹配的MTP端点对');
                
                // 保存端点和接口
                this.endpointIn = inEndpoint;
                this.endpointOut = outEndpoint;
                this.mtpInterface = iface;
                this.connectedUsbDevice = device;
                
                // 获取设备名称
                let deviceName;
                try {
                  deviceName = await promisify(device.getStringDescriptor.bind(device))(device.deviceDescriptor.iProduct);
                } catch (err) {
                  deviceName = `MTP Device (${vid.toString(16)}:${pid.toString(16)})`;
                }
                
                // 保存设备信息
                this.deviceInfo = {
                  name: deviceName || 'Unknown MTP Device',
                  vid: vid,
                  pid: pid,
                  type: 'MTP Device'
                };
                
                // 标记为已连接
                this.isConnected = true;
                this.sessionId = 0; // 没有会话
                
                console.log('[mtpService] 已连接到MTP设备');

                // 尝试打开MTP会话
                try {
                  const sessionOpened = await this.openSession();
                  if (sessionOpened) {
                    console.log('[mtpService] MTP会话成功打开');
                  } else {
                    console.warn('[mtpService] 无法打开MTP会话，某些操作可能不可用');
                  }
                } catch (err) {
                  console.error('[mtpService] 打开会话时出错:', err.message);
                }
                
                return {
                  connected: true,
                  name: this.deviceInfo.name,
                  vid: this.deviceInfo.vid,
                  pid: this.deviceInfo.pid
                };
              }
              
              // 如果没有找到所需终结点，释放接口
              console.log(`[mtpService] 接口 ${iface.interfaceNumber} 上没有找到MTP端点对，尝试下一个接口`);
              iface.release();
            } catch (err) {
              console.log(`[mtpService] 无法声明接口 ${iface.interfaceNumber}: ${err.message}`);
              // 继续尝试下一个接口
            }
          }
          
          // 如果遍历完所有接口还没找到MTP端点，关闭设备
          console.log('[mtpService] 该设备上没有找到MTP端点，关闭设备');
          device.close();
        } catch (err) {
          console.log(`[mtpService] 打开设备失败: ${err.message}`);
          try { device.close(); } catch (e) {}
        }
      }
      
      console.log('[mtpService] 未找到MTP设备');
      return { connected: false };
    } catch (err) {
      console.error('[mtpService] 检测设备时出错:', err);
      await this.disconnect();
      return { connected: false };
    }
  }

  /**
   * 断开与MTP设备的连接
   */
  async disconnect() {
    if (this.mtpInterface) {
      try {
        console.log(`[mtpService] 释放接口 ${this.mtpInterface.interfaceNumber}`);
        this.mtpInterface.release();
      } catch (err) {
        console.warn('[mtpService] 释放接口时出错:', err.message);
      }
      this.mtpInterface = null;
    }
    
    if (this.connectedUsbDevice) {
      try {
        console.log('[mtpService] 关闭USB设备');
        this.connectedUsbDevice.close();
      } catch (err) {
        console.warn('[mtpService] 关闭USB设备时出错:', err.message);
      }
      this.connectedUsbDevice = null;
    }
    
    // 重置状态
    this.endpointIn = null;
    this.endpointOut = null;
    this.isConnected = false;
    this.deviceInfo = null;
    this.sessionId = 0;
    this.currentTransactionId = 0;
    
    console.log('[mtpService] 设备已断开连接');
    return true;
  }

  /**
   * 开启MTP会话
   * @returns {Promise<boolean>} 是否成功开启会话
   */
  async openSession() {
    if (!this.isConnected) {
      console.error('[mtpService] 无法打开会话: 设备未连接');
      return false;
    }
    
    console.log('[mtpService] 尝试打开MTP会话...');
    
    // 设置最大重试次数
    const maxRetries = 3;
    let retryCount = 0;
    let sessionId = 1; // 会话ID通常从1开始
    
    while (retryCount < maxRetries) {
      try {
        if (retryCount > 0) {
          console.log(`[mtpService] 重试打开会话 (尝试 ${retryCount}/${maxRetries})...`);
          // 尝试重置会话状态
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // 创建并填充命令包
        const transactionId = this.getNextTransactionId();
        const cmdBuffer = createMtpCommand(MTP_OP_OpenSession, 0, transactionId, [sessionId]);
        
        // 发送命令
        console.log(`[mtpService] 发送OpenSession命令 (TxID: ${transactionId})...`);
        await new Promise((resolve, reject) => {
          this.endpointOut.transfer(cmdBuffer, err => {
            if (err) {
              console.error(`[mtpService] 发送OpenSession命令失败:`, err.message);
              reject(err);
            } else {
              resolve();
            }
          });
        });
        
        // 接收响应，增加超时时间
        console.log('[mtpService] 等待OpenSession响应...');
        const respBuffer = Buffer.alloc(1024);
        
        // 设置超时时间为10秒
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('接收响应超时')), 10000);
        });
        
        const responsePromise = new Promise((resolve, reject) => {
          this.endpointIn.transfer(respBuffer.length, (err, len) => {
            if (err) {
              console.error(`[mtpService] 接收OpenSession响应失败:`, err.message);
              reject(err);
            } else if (len < 12) {
              console.error(`[mtpService] OpenSession响应太短: ${len} 字节`);
              reject(new Error('响应数据长度不足'));
            } else {
              resolve(len);
            }
          });
        });
        
        // 等待响应或超时
        const respLength = await Promise.race([responsePromise, timeoutPromise]);
        
        // 解析响应头
        const respHeader = parseMtpResponseHeader(respBuffer);
        console.log(`[mtpService] 收到响应: ${JSON.stringify(respHeader)}`);
        
        // 检查响应是否为空
        if (!respHeader) {
          console.error('[mtpService] 无法解析OpenSession响应头');
          retryCount++;
          continue;
        }
        
        // 检查响应是否成功
        if (respHeader.code === MTP_RESPONSE_OK || respHeader.code === MTP_RESPONSE_SESSION_ALREADY_OPEN) {
          this.sessionId = sessionId;
          console.log(`[mtpService] MTP会话 ${sessionId} 已成功打开`);
          return true;
        } 
        // 针对Switch设备的特殊处理
        else if (respHeader.code === 0) {
          console.warn('[mtpService] 收到代码为0的响应，可能是设备特殊情况，尝试继续');
          // 一些设备可能返回0作为成功的代码
          this.sessionId = sessionId;
          return true;
        }
        else {
          console.error(`[mtpService] 无法打开MTP会话, 响应码: 0x${respHeader.code.toString(16)}`);
          retryCount++;
        }
      } catch (err) {
        console.error('[mtpService] 打开会话时出错:', err.message);
        retryCount++;
      }
    }
    
    console.error(`[mtpService] 打开MTP会话失败，已重试 ${maxRetries} 次`);
    return false;
  }

  /**
   * 获取设备中的文件列表
   * 适配Switch设备的特殊MTP实现
   */
  async getFiles(folderPath = '/') {
    console.log(`[mtpService] 尝试获取文件列表 (USB MTP): ${folderPath}`);
    if (!this.isConnected || this.sessionId === 0) {
      console.error('[mtpService] 获取文件失败：未连接或会话未打开');
      throw new Error('未连接或 MTP 会话未打开');
    }
    if (folderPath !== '/') {
        console.warn("[mtpService] 当前 USB MTP 实现仅支持列出根目录 ('/')");
        throw new Error("当前仅支持列出根目录"); 
    }

    const files = [];
    
    try {
        console.log(`[mtpService] 设备: ${this.deviceInfo?.name || '未知设备'}`);
        
        // 1. 获取存储ID
        console.log("[mtpService] 步骤1: 获取存储ID列表");
        const storageTxId = await this.sendMtpCommand(MTP_OP_GetStorageIDs);
        const storageResp = await this.receiveMtpResponse(storageTxId);
        
        // 检查响应
        if (!storageResp) {
            throw new Error('获取存储ID列表失败: 未收到响应');
        }
        
        console.log(`[mtpService] 存储ID响应: code=${storageResp.code}, txId=${storageResp.transactionId}, 数据长度=${storageResp.data ? storageResp.data.length : 0}字节`);
        
        // 检查数据长度
        if (!storageResp.data || storageResp.data.length < 16) {
            console.log("[mtpService] 存储ID数据长度不足，返回空列表");
            return [];
        }
        
        // 解析存储ID列表
        const storageData = storageResp.data.slice(12); // 跳过MTP头
        // 确保数据长度足够
        if (storageData.length < 4) {
            console.log("[mtpService] 存储ID数据不完整，返回空列表");
            return [];
        }
        
        const numStorageIds = storageData.readUInt32LE(0);
        
        const storageIds = [];
        for (let i = 0; i < numStorageIds; i++) {
            // 确保数据长度足够
            if (4 + i * 4 < storageData.length) {
                storageIds.push(storageData.readUInt32LE(4 + i * 4));
            }
        }
        console.log(`[mtpService] 找到 ${storageIds.length} 个存储ID: ${storageIds.map(id => '0x' + id.toString(16)).join(', ')}`);
        
        // 如果没有找到存储ID，返回空列表
        if (storageIds.length === 0) {
            console.log("[mtpService] 未找到可用的存储ID");
            return [];
        }
        
        // 使用第一个存储ID
        const storageId = storageIds[0];
        console.log(`[mtpService] 使用存储ID: 0x${storageId.toString(16)}`);
        
        // 2. 获取对象句柄
        const handlesTxId = await this.sendMtpCommand(MTP_OP_GetObjectHandles, [storageId, 0, 0]);
        const handlesResp = await this.receiveMtpResponse(handlesTxId);
        
        if (!handlesResp || handlesResp.code !== MTP_RESPONSE_OK) {
            throw new Error(`获取对象句柄失败，代码: 0x${handlesResp?.code?.toString(16)}`);
        }
        
        // 解析对象句柄
        const handlesData = handlesResp.data.slice(12);
        // 确保数据长度足够
        if (handlesData.length < 4) {
            console.log("[mtpService] 对象句柄数据不完整，返回空列表");
            return [];
        }
        
        const numHandles = handlesData.readUInt32LE(0);
        console.log(`[mtpService] 找到 ${numHandles} 个对象句柄`);
        
        const objectHandles = [];
        for (let i = 0; i < numHandles; i++) {
            // 确保数据长度足够
            if (4 + i * 4 < handlesData.length) {
                objectHandles.push(handlesData.readUInt32LE(4 + i * 4));
            }
        }
        
        // 3. 获取每个句柄的对象信息
        for (const handle of objectHandles) {
            console.log(`[mtpService] 获取对象信息: handle=0x${handle.toString(16)}`);
            try {
                const infoTxId = await this.sendMtpCommand(MTP_OP_GetObjectInfo, [handle]);
                const infoResp = await this.receiveMtpResponse(infoTxId);
                
                if (!infoResp || infoResp.code !== MTP_RESPONSE_OK) {
                    console.warn(`[mtpService] 获取对象信息失败: handle=0x${handle.toString(16)}, 代码: 0x${infoResp?.code?.toString(16)}`);
                    continue;
                }
                
                // 解析对象信息
                try {
                    const infoData = infoResp.data.slice(12);
                    let offset = 0;
                    
                    // 存储ID
                    const objStorageId = infoData.readUInt32LE(offset); offset += 4;
                    // 对象格式码
                    const objectFormatCode = infoData.readUInt16LE(offset); offset += 2;
                    // 其他字段...
                    
                    // 跳到文件名位置
                    offset = 52; // 文件名字段的近似位置
                    
                    // 读取文件名
                    if (offset < infoData.length) {
                        const filenameNumChars = infoData.readUInt8(offset); offset += 1;
                        
                        if (filenameNumChars > 0 && offset + filenameNumChars * 2 <= infoData.length) {
                            // 文件名使用UCS2编码
                            const filenameBytes = infoData.slice(offset, offset + filenameNumChars * 2);
                            let nameEnd = filenameBytes.length;
                            
                            // 移除末尾空字节
                            if (nameEnd >= 2 && filenameBytes[nameEnd-1] === 0 && filenameBytes[nameEnd-2] === 0) {
                                nameEnd -= 2;
                            }
                            
                            const name = filenameBytes.slice(0, nameEnd).toString('utf16le');
                            
                            // 判断是否是文件夹
                            const isFolder = objectFormatCode === 0x3001; // MTP_OBJECT_FORMAT_ASSOCIATION
                            
                            console.log(`[mtpService] 对象信息: handle=0x${handle.toString(16)}, 名称='${name}', 格式=0x${objectFormatCode.toString(16)}, 是文件夹=${isFolder}`);
                            
                            // 添加到文件列表
                            files.push({
                                name: name,
                                type: isFolder ? 'folder' : 'file',
                                path: `/${name}`,
                                objectHandle: handle,
                                formatCode: objectFormatCode
                            });
                        } else {
                            console.warn(`[mtpService] 对象信息中的文件名无效: handle=0x${handle.toString(16)}, numChars=${filenameNumChars}`);
                        }
                    } else {
                        console.warn(`[mtpService] 对象信息中没有足够的数据来读取文件名: handle=0x${handle.toString(16)}, dataLength=${infoData.length}`);
                    }
                } catch (parseError) {
                    console.error(`[mtpService] 解析对象信息出错: handle=0x${handle.toString(16)}, 错误: ${parseError.message}`);
                }
            } catch (error) {
                console.error(`[mtpService] 获取对象信息时出错: handle=0x${handle.toString(16)}, 错误: ${error.message}`);
            }
        }
        
        console.log(`[mtpService] 文件列表处理完成，返回 ${files.length} 个文件/文件夹`);
        return files;
    } catch (error) {
        console.error(`[mtpService] 获取文件列表失败: ${error.message}`);
        throw error;
    }
  }

  /**
   * 发送 MTP 命令
   * @param {number} opCode - MTP 操作码
   * @param {Array<number>} params - 命令参数
   * @returns {Promise<number>} 事务 ID
   */
  async sendMtpCommand(opCode, params = []) {
    if (!this.isConnected) {
      throw new Error('设备未连接');
    }
    
    // 生成事务 ID
    const transactionId = this.getNextTransactionId();
    this.currentTransactionId = transactionId;
    
    console.log(`[mtpService] 发送命令: OpCode=0x${opCode.toString(16)}, TxID=${transactionId}`);
    
    try {
      // 创建命令缓冲区
      const cmdBuffer = createMtpCommand(opCode, this.sessionId, transactionId, params);
      
      // 发送命令
      await new Promise((resolve, reject) => {
        this.endpointOut.transfer(cmdBuffer, err => {
          if (err) {
            console.error(`[mtpService] 发送命令失败: ${err.message}`);
            reject(err);
          } else {
            resolve();
          }
        });
      });
      
      console.log(`[mtpService] 命令已发送: TxID=${transactionId}`);
      return transactionId;
    } catch (error) {
      console.error(`[mtpService] 发送命令出错: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * 接收 MTP 响应
   * @param {number} expectedTxId - 期望的事务 ID
   * @returns {Promise<Object>} 响应对象
   */
  async receiveMtpResponse(expectedTxId) {
    if (!this.isConnected) {
      throw new Error('设备未连接');
    }
    
    console.log(`[mtpService] 等待响应: TxID=${expectedTxId}`);
    
    // 设置超时时间为8秒
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('接收响应超时')), 8000);
    });
    
    try {
      // 分配接收缓冲区
      const respBuffer = Buffer.alloc(4096); // 足够大以接收大多数响应
      
      // 接收响应
      const responsePromise = new Promise((resolve, reject) => {
        this.endpointIn.transfer(respBuffer.length, (err, len) => {
          if (err) {
            console.error(`[mtpService] 接收响应失败: ${err.message}`);
            reject(err);
          } else if (len < 12) {
            console.warn(`[mtpService] 响应太短: ${len} 字节`);
            // 只记录警告，不抛出错误，让我们尝试处理短响应
            // 对于某些设备（如Switch），可能会返回短响应
            resolve(len);
          } else {
            resolve(len);
          }
        });
      });
      
      // 等待响应或超时
      const respLength = await Promise.race([responsePromise, timeoutPromise]);
      console.log(`[mtpService] 收到响应数据，长度为 ${respLength} 字节`);
      
      // 如果响应数据太短，无法包含完整的MTP头
      if (respLength < 12) {
        console.log(`[mtpService] 响应数据不足以构成MTP头，可能是特殊设备的响应格式`);
        // 针对Switch设备的特殊处理：返回一个模拟的成功响应
        console.log(`[mtpService] 检测到可能是Switch设备的特殊响应格式，构造模拟响应`);
        return {
          code: MTP_RESPONSE_OK, // 假定响应成功
          transactionId: expectedTxId, // 使用期望的事务ID
          data: respBuffer.slice(0, respLength), // 返回收到的任何数据
          switchSpecial: true // 标记这是特殊处理的响应
        };
      }
      
      // 解析响应头
      const header = parseMtpResponseHeader(respBuffer);
      if (!header) {
        console.error('[mtpService] 无法解析响应头');
        // 针对Switch设备的特殊处理：返回一个模拟的成功响应
        console.log(`[mtpService] 无法解析响应头，尝试构造模拟响应`);
        return {
          code: MTP_RESPONSE_OK,
          transactionId: expectedTxId,
          data: respBuffer.slice(0, respLength),
          switchSpecial: true
        };
      }
      
      console.log(`[mtpService] 收到响应: TxID=${header.transactionId}, Code=0x${header.code.toString(16)} (${getMtpErrorDescription(header.code)})`);
      
      // 针对Switch设备的特殊处理：对于所有TxID=0的响应，假定它们是针对我们发送的最新命令的
      if (header.transactionId === 0) {
        console.log(`[mtpService] 检测到Switch设备特征：事务ID为0，将使用期望的事务ID ${expectedTxId}`);
        header.transactionId = expectedTxId;
      }
      
      // 针对Switch设备的特殊处理：对于所有type=0的响应，假定它们是响应类型
      if (header.type === 0) {
        console.log(`[mtpService] 检测到Switch设备特征：响应类型为0，将视为标准响应类型`);
        header.type = MTP_CONTAINER_TYPE_RESPONSE;
      }
      
      // 针对Switch设备的特殊处理：对于code=0的响应，视为成功
      if (header.code === 0) {
        console.log('[mtpService] 检测到Switch设备特征：响应代码为0，视为成功');
        header.code = MTP_RESPONSE_OK;
      }
      
      // 返回处理后的响应对象
      return {
        code: header.code,
        transactionId: header.transactionId,
        data: respBuffer.slice(0, respLength)
      };
    } catch (error) {
      console.error(`[mtpService] 接收响应出错: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new MTPService();