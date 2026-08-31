import type { AppPermission } from "@saleor/app-sdk/types";

export type PermissionOption = {
  code: AppPermission;
  label: string;
  description: string;
  group: "Store operations" | "Promotions" | "Delivery and taxes" | "Content";
};

export const permissionOptions: readonly PermissionOption[] = [
  {
    code: "MANAGE_PRODUCTS",
    label: "Products",
    description: "Products, variants, categories, collections, and stock.",
    group: "Store operations",
  },
  {
    code: "MANAGE_PRODUCT_TYPES_AND_ATTRIBUTES",
    label: "Product types and attributes",
    description: "The structures and attributes used by products.",
    group: "Store operations",
  },
  {
    code: "MANAGE_ORDERS",
    label: "Orders",
    description: "Orders, fulfillment, and related customer order data.",
    group: "Store operations",
  },
  {
    code: "MANAGE_ORDERS_IMPORT",
    label: "Order imports",
    description: "Importing orders from other systems.",
    group: "Store operations",
  },
  {
    code: "MANAGE_CHECKOUTS",
    label: "Checkouts",
    description: "Checkout details, lines, delivery, and totals.",
    group: "Store operations",
  },
  {
    code: "HANDLE_CHECKOUTS",
    label: "Checkout processing",
    description: "Operations used while processing checkouts.",
    group: "Store operations",
  },
  {
    code: "HANDLE_PAYMENTS",
    label: "Payments",
    description: "Payment and transaction operations.",
    group: "Store operations",
  },
  {
    code: "MANAGE_DISCOUNTS",
    label: "Discounts",
    description: "Promotions, vouchers, and sale prices.",
    group: "Promotions",
  },
  {
    code: "MANAGE_GIFT_CARD",
    label: "Gift cards",
    description: "Gift card balances and activity.",
    group: "Promotions",
  },
  {
    code: "MANAGE_SHIPPING",
    label: "Shipping",
    description: "Shipping zones, methods, and warehouses.",
    group: "Delivery and taxes",
  },
  {
    code: "MANAGE_TAXES",
    label: "Taxes",
    description: "Tax configuration and tax classes.",
    group: "Delivery and taxes",
  },
  {
    code: "HANDLE_TAXES",
    label: "Tax calculations",
    description: "Operations used to calculate taxes.",
    group: "Delivery and taxes",
  },
  {
    code: "MANAGE_MENUS",
    label: "Menus",
    description: "Storefront navigation menus and items.",
    group: "Content",
  },
  {
    code: "MANAGE_PAGES",
    label: "Pages",
    description: "Storefront pages and their content.",
    group: "Content",
  },
  {
    code: "MANAGE_PAGE_TYPES_AND_ATTRIBUTES",
    label: "Page types and attributes",
    description: "The structures and attributes used by pages.",
    group: "Content",
  },
  {
    code: "MANAGE_TRANSLATIONS",
    label: "Translations",
    description: "Translated product, content, and navigation fields.",
    group: "Content",
  },
];
