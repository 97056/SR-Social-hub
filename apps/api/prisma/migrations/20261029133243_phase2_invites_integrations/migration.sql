-- CreateTable
CREATE TABLE "SocialAppConfig" (
    "id" TEXT NOT NULL,
    "platformId" TEXT NOT NULL,
    "oauthClientId" TEXT,
    "clientSecretEncrypted" TEXT,
    "redirectUri" TEXT,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "apiVersion" TEXT,
    "capabilities" JSONB NOT NULL DEFAULT '{}',
    "lastError" TEXT,
    "tokenExpiryMonitor" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialAppConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "companyId" TEXT,
    "clientId" TEXT,
    "companyRole" "CompanyRole",
    "clientRole" "ClientRole",
    "status" "MembershipStatus" NOT NULL DEFAULT 'INVITED',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "invitedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SocialAppConfig_platformId_key" ON "SocialAppConfig"("platformId");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "Invitation"("tokenHash");

-- CreateIndex
CREATE INDEX "Invitation_email_idx" ON "Invitation"("email");

-- CreateIndex
CREATE INDEX "Invitation_companyId_idx" ON "Invitation"("companyId");

-- CreateIndex
CREATE INDEX "Invitation_clientId_idx" ON "Invitation"("clientId");

-- AddForeignKey
ALTER TABLE "SocialAppConfig" ADD CONSTRAINT "SocialAppConfig_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "SocialPlatform"("id") ON DELETE CASCADE ON UPDATE CASCADE;
