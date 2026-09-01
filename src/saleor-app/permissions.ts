import type { AppPermission } from "@saleor/app-sdk/types";

export type PermissionOption = {
  code: AppPermission;
  group: "Store operations" | "Promotions" | "Delivery and taxes" | "Content";
};

export const permissionOptions: readonly PermissionOption[] = [
  {
    code: "MANAGE_PRODUCTS",
    group: "Store operations",
  },
  {
    code: "MANAGE_PRODUCT_TYPES_AND_ATTRIBUTES",
    group: "Store operations",
  },
  {
    code: "MANAGE_ORDERS",
    group: "Store operations",
  },
  {
    code: "MANAGE_ORDERS_IMPORT",
    group: "Store operations",
  },
  {
    code: "MANAGE_CHECKOUTS",
    group: "Store operations",
  },
  {
    code: "HANDLE_CHECKOUTS",
    group: "Store operations",
  },
  {
    code: "HANDLE_PAYMENTS",
    group: "Store operations",
  },
  {
    code: "MANAGE_DISCOUNTS",
    group: "Promotions",
  },
  {
    code: "MANAGE_GIFT_CARD",
    group: "Promotions",
  },
  {
    code: "MANAGE_SHIPPING",
    group: "Delivery and taxes",
  },
  {
    code: "MANAGE_TAXES",
    group: "Delivery and taxes",
  },
  {
    code: "HANDLE_TAXES",
    group: "Delivery and taxes",
  },
  {
    code: "MANAGE_MENUS",
    group: "Content",
  },
  {
    code: "MANAGE_PAGES",
    group: "Content",
  },
  {
    code: "MANAGE_PAGE_TYPES_AND_ATTRIBUTES",
    group: "Content",
  },
  {
    code: "MANAGE_TRANSLATIONS",
    group: "Content",
  },
];
