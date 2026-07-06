INSERT INTO "User" ("id", "phone", "name", "role", "isActive", "updatedAt", "createdAt") 
VALUES ('packer-fixed-id-v2', '9999911111', 'Test Packer', 'PACKING', true, NOW(), NOW())
ON CONFLICT ("phone") DO UPDATE SET "role" = 'PACKING', "name" = 'Test Packer';

INSERT INTO "User" ("id", "phone", "name", "role", "isActive", "updatedAt", "createdAt") 
VALUES ('driver-fixed-id-v2', '9999922222', 'Test Driver', 'DELIVERY_PARTNER', true, NOW(), NOW())
ON CONFLICT ("phone") DO UPDATE SET "role" = 'DELIVERY_PARTNER', "name" = 'Test Driver';
