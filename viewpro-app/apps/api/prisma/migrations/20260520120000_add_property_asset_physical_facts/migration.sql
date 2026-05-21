-- Add optional physical facts for real-estate property assets.
ALTER TABLE "property_assets"
ADD COLUMN "totalAreaSqm" INTEGER,
ADD COLUMN "coveredAreaSqm" INTEGER,
ADD COLUMN "rooms" INTEGER,
ADD COLUMN "bedrooms" INTEGER,
ADD COLUMN "bathrooms" INTEGER,
ADD COLUMN "garages" INTEGER,
ADD COLUMN "ageYears" INTEGER,
ADD COLUMN "orientation" TEXT;
