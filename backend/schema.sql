-- =========================================================================================
-- DATABASE SCRIPT CHO MICROSOFT SQL SERVER (TẠO BẢNG)
-- Hướng dẫn: Copy toàn bộ đoạn mã này và chạy trong SQL Server Management Studio (SSMS)
-- =========================================================================================

-- Tạo Database (Bỏ comment 2 dòng dưới nếu bạn chưa tạo Database)
-- CREATE DATABASE AutoCallDB;
-- GO
-- USE AutoCallDB;
-- GO

-- 1. Bảng Người dùng (Users)
CREATE TABLE Users (
    Id NVARCHAR(50) PRIMARY KEY,
    Email NVARCHAR(255) NOT NULL UNIQUE,
    PasswordHash NVARCHAR(255) NOT NULL,
    Name NVARCHAR(255),
    CreatedAt DATETIME DEFAULT GETDATE()
);
GO

-- 2. Bảng Chiến dịch (Campaigns)
CREATE TABLE Campaigns (
    Id NVARCHAR(50) PRIMARY KEY,
    UserId NVARCHAR(50) FOREIGN KEY REFERENCES Users(Id),
    Name NVARCHAR(255) NOT NULL,
    Status NVARCHAR(50) DEFAULT 'paused', -- running, paused, completed
    Progress INT DEFAULT 0,
    Total INT DEFAULT 0,
    Script NVARCHAR(MAX) DEFAULT 'Chưa cấu hình',
    Type NVARCHAR(50) DEFAULT 'callbot',
    CreatedAt DATETIME DEFAULT GETDATE(),
    UpdatedAt DATETIME DEFAULT GETDATE()
);
GO

-- 3. Bảng Danh bạ Số điện thoại (Contacts)
CREATE TABLE Contacts (
    Id NVARCHAR(50) PRIMARY KEY,
    CampaignId NVARCHAR(50) FOREIGN KEY REFERENCES Campaigns(Id),
    Name NVARCHAR(255),
    Phone NVARCHAR(50) NOT NULL,
    Email NVARCHAR(255),
    Source NVARCHAR(255),
    Tags NVARCHAR(MAX), -- JSON string (vd: ["VIP", "Sale Failed"])
    LastCall NVARCHAR(50) DEFAULT '-',
    Status NVARCHAR(50) DEFAULT 'pending', -- pending, called, failed
    CreatedAt DATETIME DEFAULT GETDATE()
);
GO

-- 4. Bảng Lịch sử Cuộc gọi / Báo cáo (CallLogs)
CREATE TABLE CallLogs (
    Id NVARCHAR(50) PRIMARY KEY,
    ContactId NVARCHAR(50) FOREIGN KEY REFERENCES Contacts(Id),
    Phone NVARCHAR(50) NOT NULL,
    CustomerName NVARCHAR(255),
    Status NVARCHAR(50), -- success, failed, busy, voicemail
    Duration INT, -- Thời lượng gọi (giây)
    IntentCode NVARCHAR(100), -- Mã kịch bản (LAI_SUAT, THE_CHAP...)
    Transcript NVARCHAR(MAX), -- Nội dung cuộc gọi đã bóc băng
    AudioPath NVARCHAR(MAX), -- Đường dẫn lưu file ghi âm (.wav)
    CreatedAt DATETIME DEFAULT GETDATE()
);
GO

-- 5. Bảng Cài đặt Hệ thống (Settings)
CREATE TABLE Settings (
    [Key] NVARCHAR(100) PRIMARY KEY,
    [Value] NVARCHAR(MAX) -- Cấu hình lưu dưới dạng JSON
);
GO

-- 6. Bảng Lưu kịch bản Flow Builder theo chiến dịch
CREATE TABLE FlowData (
    CampaignId NVARCHAR(50) PRIMARY KEY FOREIGN KEY REFERENCES Campaigns(Id),
    Nodes NVARCHAR(MAX) NOT NULL DEFAULT '[]',
    Edges NVARCHAR(MAX) NOT NULL DEFAULT '[]',
    CreatedAt DATETIME DEFAULT GETDATE(),
    UpdatedAt DATETIME DEFAULT GETDATE()
);
GO

-- =========================================================================================
-- TẠO MỘT SỐ TRIGGER CƠ BẢN ĐỂ TỰ ĐỘNG CẬP NHẬT TRƯỜNG UpdatedAt
-- =========================================================================================

CREATE TRIGGER TR_Campaigns_Update
ON Campaigns
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE Campaigns
    SET UpdatedAt = GETDATE()
    FROM Campaigns c
    INNER JOIN inserted i ON c.Id = i.Id;
END;
GO

-- =========================================================================================
-- CHÈN TÀI KHOẢN ADMIN MẶC ĐỊNH ĐỂ TEST
-- =========================================================================================
INSERT INTO Users (Id, Email, PasswordHash, Name)
VALUES ('admin-uuid-1234', 'admin@autocall.local', '123456', 'Administrator');
GO
