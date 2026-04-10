/**
 * Enterprise legacy contract service alias.
 *
 * The implementation still lives in the older service while we migrate the
 * codebase away from the overloaded "B2B" name.
 */

import { BusinessContractService, businessContractService } from './business-contract-service';

export const EnterpriseLegacyContractService = BusinessContractService;
export const enterpriseLegacyContractService = businessContractService;
