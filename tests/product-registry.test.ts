import { describe, it, expect, beforeEach } from "vitest";
import { buffCV, stringAsciiCV, uintCV } from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 100;
const ERR_INVALID_HASH = 101;
const ERR_INVALID_ORIGIN = 102;
const ERR_INVALID_PRODUCTION_DATE = 103;
const ERR_INVALID_COMPLIANCE_DATA = 104;
const ERR_PRODUCT_ALREADY_EXISTS = 105;
const ERR_PRODUCT_NOT_FOUND = 106;
const ERR_INVALID_PRODUCT_TYPE = 114;
const ERR_INVALID_QUALITY_RATING = 115;
const ERR_INVALID_EXPIRY_PERIOD = 116;
const ERR_INVALID_LOCATION = 117;
const ERR_INVALID_CURRENCY = 118;
const ERR_INVALID_MIN_VALUE = 109;
const ERR_INVALID_MAX_VALUE = 110;
const ERR_MAX_PRODUCTS_EXCEEDED = 113;
const ERR_INVALID_UPDATE_PARAM = 112;
const ERR_AUTHORITY_NOT_VERIFIED = 108;

interface Product {
  hash: Buffer;
  origin: string;
  productionDate: number;
  complianceData: string;
  timestamp: number;
  producer: string;
  productType: string;
  qualityRating: number;
  expiryPeriod: number;
  location: string;
  currency: string;
  status: boolean;
  minValue: number;
  maxValue: number;
  batchSize: number;
}

interface ProductUpdate {
  updateOrigin: string;
  updateProductionDate: number;
  updateComplianceData: string;
  updateTimestamp: number;
  updater: string;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class ProductRegistryMock {
  state: {
    nextProductId: number;
    maxProducts: number;
    registrationFee: number;
    authorityContract: string | null;
    products: Map<number, Product>;
    productUpdates: Map<number, ProductUpdate>;
    productsByHash: Map<string, number>;
  } = {
    nextProductId: 0,
    maxProducts: 10000,
    registrationFee: 500,
    authorityContract: null,
    products: new Map(),
    productUpdates: new Map(),
    productsByHash: new Map(),
  };
  blockHeight: number = 0;
  caller: string = "ST1TEST";
  authorities: Set<string> = new Set(["ST1TEST"]);
  stxTransfers: Array<{ amount: number; from: string; to: string | null }> = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      nextProductId: 0,
      maxProducts: 10000,
      registrationFee: 500,
      authorityContract: null,
      products: new Map(),
      productUpdates: new Map(),
      productsByHash: new Map(),
    };
    this.blockHeight = 0;
    this.caller = "ST1TEST";
    this.authorities = new Set(["ST1TEST"]);
    this.stxTransfers = [];
  }

  isVerifiedAuthority(principal: string): Result<boolean> {
    return { ok: true, value: this.authorities.has(principal) };
  }

  setAuthorityContract(contractPrincipal: string): Result<boolean> {
    if (contractPrincipal === "SP000000000000000000002Q6VF78") {
      return { ok: false, value: false };
    }
    if (this.state.authorityContract !== null) {
      return { ok: false, value: false };
    }
    this.state.authorityContract = contractPrincipal;
    return { ok: true, value: true };
  }

  setRegistrationFee(newFee: number): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: false };
    this.state.registrationFee = newFee;
    return { ok: true, value: true };
  }

  registerProduct(
    hash: Buffer,
    origin: string,
    productionDate: number,
    complianceData: string,
    productType: string,
    qualityRating: number,
    expiryPeriod: number,
    location: string,
    currency: string,
    minValue: number,
    maxValue: number,
    batchSize: number
  ): Result<number> {
    if (this.state.nextProductId >= this.state.maxProducts) return { ok: false, value: ERR_MAX_PRODUCTS_EXCEEDED };
    if (hash.length !== 32) return { ok: false, value: ERR_INVALID_HASH };
    if (!origin || origin.length > 100) return { ok: false, value: ERR_INVALID_ORIGIN };
    if (productionDate <= 0) return { ok: false, value: ERR_INVALID_PRODUCTION_DATE };
    if (complianceData.length > 200) return { ok: false, value: ERR_INVALID_COMPLIANCE_DATA };
    if (!["organic", "manufactured", "processed"].includes(productType)) return { ok: false, value: ERR_INVALID_PRODUCT_TYPE };
    if (qualityRating > 100) return { ok: false, value: ERR_INVALID_QUALITY_RATING };
    if (expiryPeriod <= 0) return { ok: false, value: ERR_INVALID_EXPIRY_PERIOD };
    if (!location || location.length > 100) return { ok: false, value: ERR_INVALID_LOCATION };
    if (!["STX", "USD", "BTC"].includes(currency)) return { ok: false, value: ERR_INVALID_CURRENCY };
    if (minValue <= 0) return { ok: false, value: ERR_INVALID_MIN_VALUE };
    if (maxValue <= 0) return { ok: false, value: ERR_INVALID_MAX_VALUE };
    if (batchSize <= 0) return { ok: false, value: ERR_INVALID_BATCH_SIZE };
    if (!this.isVerifiedAuthority(this.caller).value) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (this.state.productsByHash.has(hash.toString('hex'))) return { ok: false, value: ERR_PRODUCT_ALREADY_EXISTS };
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };

    this.stxTransfers.push({ amount: this.state.registrationFee, from: this.caller, to: this.state.authorityContract });

    const id = this.state.nextProductId;
    const product: Product = {
      hash,
      origin,
      productionDate,
      complianceData,
      timestamp: this.blockHeight,
      producer: this.caller,
      productType,
      qualityRating,
      expiryPeriod,
      location,
      currency,
      status: true,
      minValue,
      maxValue,
      batchSize,
    };
    this.state.products.set(id, product);
    this.state.productsByHash.set(hash.toString('hex'), id);
    this.state.nextProductId++;
    return { ok: true, value: id };
  }

  getProduct(id: number): Product | null {
    return this.state.products.get(id) || null;
  }

  updateProduct(id: number, updateOrigin: string, updateProductionDate: number, updateComplianceData: string): Result<boolean> {
    const product = this.state.products.get(id);
    if (!product) return { ok: false, value: false };
    if (product.producer !== this.caller) return { ok: false, value: false };
    if (!updateOrigin || updateOrigin.length > 100) return { ok: false, value: false };
    if (updateProductionDate <= 0) return { ok: false, value: false };
    if (updateComplianceData.length > 200) return { ok: false, value: false };

    const updated: Product = {
      ...product,
      origin: updateOrigin,
      productionDate: updateProductionDate,
      complianceData: updateComplianceData,
      timestamp: this.blockHeight,
    };
    this.state.products.set(id, updated);
    this.state.productUpdates.set(id, {
      updateOrigin,
      updateProductionDate,
      updateComplianceData,
      updateTimestamp: this.blockHeight,
      updater: this.caller,
    });
    return { ok: true, value: true };
  }

  getProductCount(): Result<number> {
    return { ok: true, value: this.state.nextProductId };
  }

  checkProductExistence(hash: Buffer): Result<boolean> {
    return { ok: true, value: this.state.productsByHash.has(hash.toString('hex')) };
  }
}

describe("ProductRegistry", () => {
  let contract: ProductRegistryMock;

  beforeEach(() => {
    contract = new ProductRegistryMock();
    contract.reset();
  });

  it("registers a product successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = Buffer.alloc(32, 0);
    const result = contract.registerProduct(
      hash,
      "OriginX",
      100,
      "Compliant",
      "organic",
      90,
      365,
      "LocationY",
      "STX",
      50,
      1000,
      10
    );
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0);

    const product = contract.getProduct(0);
    expect(product?.origin).toBe("OriginX");
    expect(product?.productionDate).toBe(100);
    expect(product?.complianceData).toBe("Compliant");
    expect(product?.productType).toBe("organic");
    expect(product?.qualityRating).toBe(90);
    expect(product?.expiryPeriod).toBe(365);
    expect(product?.location).toBe("LocationY");
    expect(product?.currency).toBe("STX");
    expect(product?.minValue).toBe(50);
    expect(product?.maxValue).toBe(1000);
    expect(product?.batchSize).toBe(10);
    expect(contract.stxTransfers).toEqual([{ amount: 500, from: "ST1TEST", to: "ST2TEST" }]);
  });

  it("rejects duplicate product hashes", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = Buffer.alloc(32, 0);
    contract.registerProduct(
      hash,
      "OriginX",
      100,
      "Compliant",
      "organic",
      90,
      365,
      "LocationY",
      "STX",
      50,
      1000,
      10
    );
    const result = contract.registerProduct(
      hash,
      "OriginZ",
      200,
      "Compliant2",
      "manufactured",
      80,
      730,
      "LocationW",
      "USD",
      100,
      2000,
      20
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_PRODUCT_ALREADY_EXISTS);
  });

  it("rejects non-authorized caller", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.caller = "ST2FAKE";
    contract.authorities = new Set();
    const hash = Buffer.alloc(32, 0);
    const result = contract.registerProduct(
      hash,
      "OriginX",
      100,
      "Compliant",
      "organic",
      90,
      365,
      "LocationY",
      "STX",
      50,
      1000,
      10
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("rejects product registration without authority contract", () => {
    const hash = Buffer.alloc(32, 0);
    const result = contract.registerProduct(
      hash,
      "NoAuth",
      100,
      "Compliant",
      "organic",
      90,
      365,
      "LocationY",
      "STX",
      50,
      1000,
      10
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_AUTHORITY_NOT_VERIFIED);
  });

  it("rejects invalid hash", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = Buffer.alloc(31, 0);
    const result = contract.registerProduct(
      hash,
      "OriginX",
      100,
      "Compliant",
      "organic",
      90,
      365,
      "LocationY",
      "STX",
      50,
      1000,
      10
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_HASH);
  });

  it("rejects invalid origin", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = Buffer.alloc(32, 0);
    const result = contract.registerProduct(
      hash,
      "",
      100,
      "Compliant",
      "organic",
      90,
      365,
      "LocationY",
      "STX",
      50,
      1000,
      10
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_ORIGIN);
  });

  it("rejects invalid product type", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = Buffer.alloc(32, 0);
    const result = contract.registerProduct(
      hash,
      "OriginX",
      100,
      "Compliant",
      "invalid",
      90,
      365,
      "LocationY",
      "STX",
      50,
      1000,
      10
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_PRODUCT_TYPE);
  });

  it("updates a product successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = Buffer.alloc(32, 0);
    contract.registerProduct(
      hash,
      "OldOrigin",
      100,
      "OldCompliant",
      "organic",
      90,
      365,
      "LocationY",
      "STX",
      50,
      1000,
      10
    );
    const result = contract.updateProduct(0, "NewOrigin", 200, "NewCompliant");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const product = contract.getProduct(0);
    expect(product?.origin).toBe("NewOrigin");
    expect(product?.productionDate).toBe(200);
    expect(product?.complianceData).toBe("NewCompliant");
    const update = contract.state.productUpdates.get(0);
    expect(update?.updateOrigin).toBe("NewOrigin");
    expect(update?.updateProductionDate).toBe(200);
    expect(update?.updateComplianceData).toBe("NewCompliant");
    expect(update?.updater).toBe("ST1TEST");
  });

  it("rejects update for non-existent product", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.updateProduct(99, "NewOrigin", 200, "NewCompliant");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("rejects update by non-producer", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = Buffer.alloc(32, 0);
    contract.registerProduct(
      hash,
      "OriginX",
      100,
      "Compliant",
      "organic",
      90,
      365,
      "LocationY",
      "STX",
      50,
      1000,
      10
    );
    contract.caller = "ST3FAKE";
    const result = contract.updateProduct(0, "NewOrigin", 200, "NewCompliant");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("sets registration fee successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.setRegistrationFee(1000);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.registrationFee).toBe(1000);
    const hash = Buffer.alloc(32, 0);
    contract.registerProduct(
      hash,
      "OriginX",
      100,
      "Compliant",
      "organic",
      90,
      365,
      "LocationY",
      "STX",
      50,
      1000,
      10
    );
    expect(contract.stxTransfers).toEqual([{ amount: 1000, from: "ST1TEST", to: "ST2TEST" }]);
  });

  it("rejects registration fee change without authority contract", () => {
    const result = contract.setRegistrationFee(1000);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("returns correct product count", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash1 = Buffer.alloc(32, 0);
    contract.registerProduct(
      hash1,
      "Origin1",
      100,
      "Compliant1",
      "organic",
      90,
      365,
      "Location1",
      "STX",
      50,
      1000,
      10
    );
    const hash2 = Buffer.alloc(32, 1);
    contract.registerProduct(
      hash2,
      "Origin2",
      200,
      "Compliant2",
      "manufactured",
      80,
      730,
      "Location2",
      "USD",
      100,
      2000,
      20
    );
    const result = contract.getProductCount();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(2);
  });

  it("checks product existence correctly", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = Buffer.alloc(32, 0);
    contract.registerProduct(
      hash,
      "OriginX",
      100,
      "Compliant",
      "organic",
      90,
      365,
      "LocationY",
      "STX",
      50,
      1000,
      10
    );
    const result = contract.checkProductExistence(hash);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const hash2 = Buffer.alloc(32, 1);
    const result2 = contract.checkProductExistence(hash2);
    expect(result2.ok).toBe(true);
    expect(result2.value).toBe(false);
  });

  it("rejects product registration with empty origin", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = Buffer.alloc(32, 0);
    const result = contract.registerProduct(
      hash,
      "",
      100,
      "Compliant",
      "organic",
      90,
      365,
      "LocationY",
      "STX",
      50,
      1000,
      10
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_ORIGIN);
  });

  it("rejects product registration with max products exceeded", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.state.maxProducts = 1;
    const hash1 = Buffer.alloc(32, 0);
    contract.registerProduct(
      hash1,
      "Origin1",
      100,
      "Compliant1",
      "organic",
      90,
      365,
      "Location1",
      "STX",
      50,
      1000,
      10
    );
    const hash2 = Buffer.alloc(32, 1);
    const result = contract.registerProduct(
      hash2,
      "Origin2",
      200,
      "Compliant2",
      "manufactured",
      80,
      730,
      "Location2",
      "USD",
      100,
      2000,
      20
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_MAX_PRODUCTS_EXCEEDED);
  });

  it("sets authority contract successfully", () => {
    const result = contract.setAuthorityContract("ST2TEST");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.authorityContract).toBe("ST2TEST");
  });

  it("rejects invalid authority contract", () => {
    const result = contract.setAuthorityContract("SP000000000000000000002Q6VF78");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });
});