import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261110091459 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "wishlist_item" drop constraint if exists "wishlist_item_wishlist_id_item_key_unique";`);
    this.addSql(`alter table if exists "wishlist" drop constraint if exists "wishlist_share_token_hash_unique";`);
    this.addSql(`alter table if exists "wishlist" drop constraint if exists "wishlist_guest_token_hash_unique";`);
    this.addSql(`alter table if exists "wishlist" drop constraint if exists "wishlist_customer_id_unique";`);
    this.addSql(`alter table if exists "product_wishlist_count" drop constraint if exists "product_wishlist_count_product_id_unique";`);
    this.addSql(`create table if not exists "product_wishlist_count" ("id" text not null, "product_id" text not null, "count" integer not null default 0, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "product_wishlist_count_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_product_wishlist_count_product_id_unique" ON "product_wishlist_count" ("product_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_product_wishlist_count_deleted_at" ON "product_wishlist_count" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "wishlist" ("id" text not null, "customer_id" text null, "guest_token_hash" text null, "share_token_hash" text null, "name" text null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "wishlist_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_wishlist_customer_id_unique" ON "wishlist" ("customer_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_wishlist_guest_token_hash_unique" ON "wishlist" ("guest_token_hash") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_wishlist_share_token_hash_unique" ON "wishlist" ("share_token_hash") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_wishlist_deleted_at" ON "wishlist" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "wishlist_item" ("id" text not null, "wishlist_id" text not null, "product_id" text not null, "variant_id" text null, "item_key" text not null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "wishlist_item_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_wishlist_item_wishlist_id" ON "wishlist_item" ("wishlist_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_wishlist_item_deleted_at" ON "wishlist_item" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_wishlist_item_wishlist_id_item_key_unique" ON "wishlist_item" ("wishlist_id", "item_key") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_wishlist_item_product_id" ON "wishlist_item" ("product_id") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "wishlist_item" add constraint "wishlist_item_wishlist_id_foreign" foreign key ("wishlist_id") references "wishlist" ("id") on update cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "wishlist_item" drop constraint if exists "wishlist_item_wishlist_id_foreign";`);

    this.addSql(`drop table if exists "product_wishlist_count" cascade;`);

    this.addSql(`drop table if exists "wishlist" cascade;`);

    this.addSql(`drop table if exists "wishlist_item" cascade;`);
  }

}
