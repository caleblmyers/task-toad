-- CreateTable
CREATE TABLE "user_capacities" (
    "user_capacity_id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "hours_per_week" INTEGER NOT NULL DEFAULT 40,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_capacities_pkey" PRIMARY KEY ("user_capacity_id")
);

-- CreateTable
CREATE TABLE "user_time_off" (
    "user_time_off_id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "start_date" TEXT NOT NULL,
    "end_date" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_time_off_pkey" PRIMARY KEY ("user_time_off_id")
);

-- CreateIndex
CREATE INDEX "user_capacities_org_id_idx" ON "user_capacities"("org_id");

-- CreateIndex
CREATE INDEX "user_capacities_user_id_idx" ON "user_capacities"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_capacities_org_id_user_id_key" ON "user_capacities"("org_id", "user_id");

-- CreateIndex
CREATE INDEX "user_time_off_user_id_start_date_idx" ON "user_time_off"("user_id", "start_date");

-- CreateIndex
CREATE INDEX "user_time_off_org_id_idx" ON "user_time_off"("org_id");

-- AddForeignKey
ALTER TABLE "user_capacities" ADD CONSTRAINT "user_capacities_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("org_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_capacities" ADD CONSTRAINT "user_capacities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_time_off" ADD CONSTRAINT "user_time_off_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("org_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_time_off" ADD CONSTRAINT "user_time_off_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
