-- BAUMB schema for SQL Server 2014+. Idempotent: safe to run repeatedly.
USE baumb;
GO

IF OBJECT_ID('dbo.Users', 'U') IS NULL
CREATE TABLE dbo.Users (
  Id           UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_Users PRIMARY KEY CONSTRAINT DF_Users_Id DEFAULT NEWID(),
  Email        NVARCHAR(254)    NOT NULL CONSTRAINT UQ_Users_Email UNIQUE,
  Name         NVARCHAR(100)    NOT NULL,
  PasswordHash VARCHAR(200)     NOT NULL,
  CreatedAt    DATETIME2(3)     NOT NULL CONSTRAINT DF_Users_CreatedAt DEFAULT SYSUTCDATETIME(),
  LastSignInAt DATETIME2(3)     NULL
);
GO

-- Only a SHA-256 hash of each session token is stored; the token itself lives in an HTTP-only cookie.
IF OBJECT_ID('dbo.Sessions', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.Sessions (
    TokenHash CHAR(64)         NOT NULL CONSTRAINT PK_Sessions PRIMARY KEY,
    UserId    UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_Sessions_Users REFERENCES dbo.Users (Id) ON DELETE CASCADE,
    CreatedAt DATETIME2(3)     NOT NULL CONSTRAINT DF_Sessions_CreatedAt DEFAULT SYSUTCDATETIME(),
    ExpiresAt DATETIME2(3)     NOT NULL,
    UserAgent NVARCHAR(300)    NULL
  );
  CREATE INDEX IX_Sessions_UserId ON dbo.Sessions (UserId);
END
GO

-- Everything the user enters (profile, goal, plans, workouts, meals, weigh-ins, measurements, photos,
-- activity, recovery, vacations, events, reviews, audit log, settings) as one JSON document per user.
-- Revision increments on every save so two devices can't silently overwrite each other.
IF OBJECT_ID('dbo.UserData', 'U') IS NULL
CREATE TABLE dbo.UserData (
  UserId    UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_UserData PRIMARY KEY CONSTRAINT FK_UserData_Users REFERENCES dbo.Users (Id) ON DELETE CASCADE,
  StateJson NVARCHAR(MAX)    NOT NULL,
  Revision  INT              NOT NULL CONSTRAINT DF_UserData_Revision DEFAULT 1,
  UpdatedAt DATETIME2(3)     NOT NULL CONSTRAINT DF_UserData_UpdatedAt DEFAULT SYSUTCDATETIME()
);
GO
