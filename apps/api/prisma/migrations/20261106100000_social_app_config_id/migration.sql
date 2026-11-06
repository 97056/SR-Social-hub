-- Meta Login for Business configuration id (shared by Facebook / Instagram; optional on Threads).
ALTER TABLE "SocialAppConfig" ADD COLUMN IF NOT EXISTS "configId" TEXT;
