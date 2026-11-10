import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261110091500 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "review_request" drop constraint if exists "review_request_token_hash_unique";`);
    this.addSql(`alter table if exists "review_request" drop constraint if exists "review_request_order_id_unique";`);
    this.addSql(`alter table if exists "review_reply" drop constraint if exists "review_reply_review_id_unique";`);
    this.addSql(`alter table if exists "review_opt_out" drop constraint if exists "review_opt_out_email_hash_unique";`);
    this.addSql(`alter table if exists "review" drop constraint if exists "review_order_item_id_unique";`);
    this.addSql(`alter table if exists "product_rating" drop constraint if exists "product_rating_product_id_unique";`);
    this.addSql(`create table if not exists "product_rating" ("id" text not null, "product_id" text not null, "average" real not null default 0, "count" integer not null default 0, "count_1" integer not null default 0, "count_2" integer not null default 0, "count_3" integer not null default 0, "count_4" integer not null default 0, "count_5" integer not null default 0, "last_review_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "product_rating_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_product_rating_product_id_unique" ON "product_rating" ("product_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_product_rating_deleted_at" ON "product_rating" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "review" ("id" text not null, "product_id" text not null, "variant_id" text null, "order_id" text not null, "order_item_id" text not null, "customer_id" text null, "email" text null, "display_name" text not null, "rating" integer not null, "title" text null, "body" text not null, "locale" text null, "status" text check ("status" in ('pending', 'approved', 'rejected')) not null default 'pending', "verified" boolean not null default true, "source" text not null default 'store', "ip_hash" text null, "approved_at" timestamptz null, "rejected_at" timestamptz null, "moderated_by" text null, "reject_reason" text null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "review_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_review_order_item_id_unique" ON "review" ("order_item_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_review_deleted_at" ON "review" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_review_product_id_status" ON "review" ("product_id", "status") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_review_order_id" ON "review" ("order_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_review_customer_id" ON "review" ("customer_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_review_email" ON "review" ("email") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "review_image" ("id" text not null, "review_id" text not null, "private_file_id" text null, "file_id" text null, "url" text null, "mime_type" text not null, "size" integer not null, "position" integer not null default 0, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "review_image_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_review_image_review_id" ON "review_image" ("review_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_review_image_deleted_at" ON "review_image" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "review_opt_out" ("id" text not null, "email_hash" text not null, "source" text not null default 'link', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "review_opt_out_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_review_opt_out_email_hash_unique" ON "review_opt_out" ("email_hash") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_review_opt_out_deleted_at" ON "review_opt_out" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "review_reply" ("id" text not null, "review_id" text not null, "body" text not null, "author_id" text null, "author_name" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "review_reply_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_review_reply_review_id_unique" ON "review_reply" ("review_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_review_reply_deleted_at" ON "review_reply" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "review_request" ("id" text not null, "order_id" text not null, "customer_id" text null, "email" text not null, "email_hash" text not null, "token_hash" text null, "trigger" text not null, "delay_days" integer not null, "scheduled_at" timestamptz not null, "sent_at" timestamptz null, "expires_at" timestamptz null, "used_at" timestamptz null, "status" text check ("status" in ('scheduled', 'sent', 'used', 'expired', 'skipped', 'failed', 'opted_out')) not null default 'scheduled', "locale" text null, "region_id" text null, "sales_channel_id" text null, "attempts" integer not null default 0, "last_error" text null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "review_request_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_review_request_order_id_unique" ON "review_request" ("order_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_review_request_token_hash_unique" ON "review_request" ("token_hash") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_review_request_deleted_at" ON "review_request" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_review_request_status_scheduled_at" ON "review_request" ("status", "scheduled_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_review_request_email_hash" ON "review_request" ("email_hash") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_review_request_customer_id" ON "review_request" ("customer_id") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "review_upload" ("id" text not null, "owner" text not null, "file_id" text not null, "mime_type" text not null, "size" integer not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "review_upload_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_review_upload_deleted_at" ON "review_upload" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_review_upload_owner" ON "review_upload" ("owner") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "review_image" add constraint "review_image_review_id_foreign" foreign key ("review_id") references "review" ("id") on update cascade;`);

    this.addSql(`alter table if exists "review_reply" add constraint "review_reply_review_id_foreign" foreign key ("review_id") references "review" ("id") on update cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "review_image" drop constraint if exists "review_image_review_id_foreign";`);

    this.addSql(`alter table if exists "review_reply" drop constraint if exists "review_reply_review_id_foreign";`);

    this.addSql(`drop table if exists "product_rating" cascade;`);

    this.addSql(`drop table if exists "review" cascade;`);

    this.addSql(`drop table if exists "review_image" cascade;`);

    this.addSql(`drop table if exists "review_opt_out" cascade;`);

    this.addSql(`drop table if exists "review_reply" cascade;`);

    this.addSql(`drop table if exists "review_request" cascade;`);

    this.addSql(`drop table if exists "review_upload" cascade;`);
  }

}
