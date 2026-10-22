public with sharing class AddFeesController {
    
    /**
     * Method to create Fee Product records
     * @param productNames List of product names to create
     * @return List of created Product records
     */
    @AuraEnabled
    public static List<Product2> createFeeProducts(List<String> productNames) {
        try {
            List<Product2> productsToInsert = new List<Product2>();
            
            // Create Product2 records for each product name
            for (String productName : productNames) {
                if (String.isNotBlank(productName)) {
                    Product2 product = new Product2();
                    product.Name = productName;
                    product.ProductCode = generateProductCode(productName);
                    product.IsActive = true;
                    product.Family = 'Fee';
                    product.Description = 'School Fee Product - ' + productName;
                    productsToInsert.add(product);
                }
            }
            
            // Insert all products
            if (!productsToInsert.isEmpty()) {
                insert productsToInsert;
                System.debug('Successfully created ' + productsToInsert.size() + ' products');
                return productsToInsert;
            }
            
            return new List<Product2>();
            
        } catch (Exception e) {
            System.debug('Error creating products: ' + e.getMessage());
            throw new AuraHandledException('Error creating products: ' + e.getMessage());
        }
    }
    
    /**
     * Method to get existing price book entries for a class
     * @param className The class name
     * @return Map of Product ID to Price
     */
    @AuraEnabled
    public static Map<String, Decimal> getExistingPrices(String className, String academicYearId, String priceBookId) {
        try {
            Map<String, Decimal> priceMap = new Map<String, Decimal>();
            
            if (String.isBlank(academicYearId)) return priceMap;

            Id targetPriceBookId = null;
            if (String.isNotBlank(priceBookId)) {
                targetPriceBookId = priceBookId;
            } else {
                // Convert "Class-1" to "Class 1" for Pricebook lookup
                String classBaseName = className != null ? className.replace('-', ' ') : '';
                // Find the price book for this class and specific year
                List<Pricebook2> priceBooks = [
                    SELECT Id, Name
                    FROM Pricebook2
                    WHERE Academic_Year__c = :academicYearId
                    AND Name LIKE :classBaseName + '%'
                    LIMIT 1
                ];
                if (!priceBooks.isEmpty()) {
                    targetPriceBookId = priceBooks[0].Id;
                }
            }
            
            if (targetPriceBookId == null) {
                return priceMap;
            }
            
            Id finalPriceBookId = targetPriceBookId;
            
            // Get all price book entries for this price book
            List<PricebookEntry> entries = [
                SELECT Id, Product2Id, UnitPrice, IsActive
                FROM PricebookEntry
                WHERE Pricebook2Id = :finalPriceBookId
                AND IsActive = true
            ];
            
            // Build map of Product ID to Price
            for (PricebookEntry entry : entries) {
                priceMap.put(entry.Product2Id, entry.UnitPrice);
            }
            
            System.debug('Found ' + priceMap.size() + ' existing prices for ' + className);
            return priceMap;
            
        } catch (Exception e) {
            System.debug('Error getting existing prices: ' + e.getMessage());
            throw new AuraHandledException('Error getting existing prices: ' + e.getMessage());
        }
    }
    
    /**
     * Method to create Price Book Entries for selected products and class
     * @param className The class name (e.g., "Class 10")
     * @param priceBookData List of wrapper objects containing product info and prices
     * @return Success message with created entries count
     */
    @AuraEnabled
    public static Map<String, Object> createPriceBookEntries(String className, String academicYearId, List<Map<String, Object>> priceBookData) {
        try {
            System.debug('Creating price book entries for class: ' + className + ' Year: ' + academicYearId);
            
            if (String.isBlank(academicYearId)) {
                throw new AuraHandledException('Academic Year is required.');
            }

            Academic_Year__c ay = [SELECT Name FROM Academic_Year__c WHERE Id = :academicYearId LIMIT 1];
            
            Map<String, Object> result = new Map<String, Object>();
            
            // Convert "Class-1" to "Class 1" for Pricebook lookup
            String classBaseName = className.replace('-', ' ');
            String priceBookName = classBaseName + ' - ' + ay.Name;

            // Get or create custom Price Book for the class and year
            Pricebook2 classPriceBook = getOrCreateClassPriceBook(priceBookName, academicYearId);
            System.debug('Class price book: ' + classPriceBook);
            
            // Get Standard Price Book ID
            Id standardPriceBookId = getStandardPriceBookId();
            System.debug('Standard price book ID: ' + standardPriceBookId);
            
            List<PricebookEntry> standardEntriesToCreate = new List<PricebookEntry>();
            List<PricebookEntry> customEntriesToCreate = new List<PricebookEntry>();
            List<PricebookEntry> entriesToUpdate = new List<PricebookEntry>();
            Set<Id> productIds = new Set<Id>();
            Map<Id, Decimal> productPriceMap = new Map<Id, Decimal>();
            
            // Parse the data and collect product IDs and prices
            for (Map<String, Object> data : priceBookData) {
                String productIdStr = (String) data.get('productId');
                Object priceObj = data.get('price');
                
                Decimal price;
                if (priceObj instanceof Decimal) {
                    price = (Decimal) priceObj;
                } else if (priceObj instanceof Double) {
                    price = Decimal.valueOf((Double) priceObj);
                } else if (priceObj instanceof Integer) {
                    price = Decimal.valueOf((Integer) priceObj);
                } else if (priceObj instanceof String) {
                    price = Decimal.valueOf((String) priceObj);
                }
                
                System.debug('Processing product: ' + productIdStr + ' with price: ' + price);
                
                if (String.isNotBlank(productIdStr) && price != null && price > 0) {
                    productIds.add(productIdStr);
                    productPriceMap.put(productIdStr, price);
                }
            }
            
            System.debug('Product IDs: ' + productIds);
            System.debug('Product prices: ' + productPriceMap);
            
            // Check which products already have standard price book entries
            List<PricebookEntry> existingStandardEntries = [
                SELECT Id, Product2Id, Pricebook2Id, UnitPrice
                FROM PricebookEntry
                WHERE Product2Id IN :productIds 
                AND Pricebook2Id = :standardPriceBookId
            ];
            
            System.debug('Existing standard entries: ' + existingStandardEntries.size());
            
            Map<Id, PricebookEntry> standardEntriesMap = new Map<Id, PricebookEntry>();
            for (PricebookEntry entry : existingStandardEntries) {
                standardEntriesMap.put(entry.Product2Id, entry);
            }
            
            // Create or update standard price book entries
            for (Id productId : productIds) {
                Decimal unitPrice = productPriceMap.get(productId);
                
                if (unitPrice != null && unitPrice > 0) {
                    if (standardEntriesMap.containsKey(productId)) {
                        // Update existing entry
                        PricebookEntry existingEntry = standardEntriesMap.get(productId);
                        if (existingEntry.UnitPrice != unitPrice) {
                            existingEntry.UnitPrice = unitPrice;
                            entriesToUpdate.add(existingEntry);
                            System.debug('Updating standard entry for product: ' + productId);
                        }
                    } else {
                        // Create new entry
                        PricebookEntry standardEntry = new PricebookEntry();
                        standardEntry.Pricebook2Id = standardPriceBookId;
                        standardEntry.Product2Id = productId;
                        standardEntry.UnitPrice = unitPrice;
                        standardEntry.IsActive = true;
                        standardEntry.UseStandardPrice = false;
                        standardEntriesToCreate.add(standardEntry);
                        System.debug('Creating standard entry for product: ' + productId + ' with price: ' + unitPrice);
                    }
                }
            }
            
            // Insert new standard entries
            if (!standardEntriesToCreate.isEmpty()) {
                System.debug('Inserting ' + standardEntriesToCreate.size() + ' standard entries');
                insert standardEntriesToCreate;
            }
            
            // Update existing standard entries
            if (!entriesToUpdate.isEmpty()) {
                System.debug('Updating ' + entriesToUpdate.size() + ' standard entries');
                update entriesToUpdate;
            }
            
            // Check for existing custom price book entries for this class
            List<PricebookEntry> existingCustomEntries = [
                SELECT Id, Product2Id, UnitPrice
                FROM PricebookEntry
                WHERE Product2Id IN :productIds 
                AND Pricebook2Id = :classPriceBook.Id
            ];
            
            System.debug('Existing custom entries: ' + existingCustomEntries.size());
            
            Map<Id, PricebookEntry> customEntriesMap = new Map<Id, PricebookEntry>();
            for (PricebookEntry entry : existingCustomEntries) {
                customEntriesMap.put(entry.Product2Id, entry);
            }
            
            List<PricebookEntry> customEntriesToUpdate = new List<PricebookEntry>();
            
            // Create or update custom price book entries
            for (Id productId : productIds) {
                Decimal unitPrice = productPriceMap.get(productId);
                
                if (unitPrice != null && unitPrice > 0) {
                    if (customEntriesMap.containsKey(productId)) {
                        // Update existing custom entry
                        PricebookEntry existingEntry = customEntriesMap.get(productId);
                        if (existingEntry.UnitPrice != unitPrice) {
                            existingEntry.UnitPrice = unitPrice;
                            customEntriesToUpdate.add(existingEntry);
                            System.debug('Updating custom entry for product: ' + productId);
                        }
                    } else {
                        // Create new custom entry
                        PricebookEntry customEntry = new PricebookEntry();
                        customEntry.Pricebook2Id = classPriceBook.Id;
                        customEntry.Product2Id = productId;
                        customEntry.UnitPrice = unitPrice;
                        customEntry.IsActive = true;
                        customEntry.UseStandardPrice = false;
                        customEntriesToCreate.add(customEntry);
                        System.debug('Creating custom entry for product: ' + productId + ' with price: ' + unitPrice);
                    }
                }
            }
            
            // Insert new custom entries
            if (!customEntriesToCreate.isEmpty()) {
                System.debug('Inserting ' + customEntriesToCreate.size() + ' custom entries');
                insert customEntriesToCreate;
            }
            
            // Update existing custom entries
            if (!customEntriesToUpdate.isEmpty()) {
                System.debug('Updating ' + customEntriesToUpdate.size() + ' custom entries');
                update customEntriesToUpdate;
            }
            
            Integer totalEntries = customEntriesToCreate.size() + customEntriesToUpdate.size();
            
            // Prepare result
            result.put('success', true);
            result.put('priceBookId', classPriceBook.Id);
            result.put('priceBookName', classPriceBook.Name);
            result.put('entriesCreated', totalEntries);
            result.put('message', 'Successfully processed ' + totalEntries + ' price book entries for ' + className);
            
            System.debug('Result: ' + result);
            return result;
            
        } catch (Exception e) {
            System.debug('Error creating price book entries: ' + e.getMessage());
            System.debug('Stack trace: ' + e.getStackTraceString());
            System.debug('Line number: ' + e.getLineNumber());
            throw new AuraHandledException('Error creating price book entries: ' + e.getMessage());
        }
    }
    
    /**
     * Get or create a Price Book for a specific class and year
     * @param priceBookName Name of the pricebook
     * @param academicYearId ID of the academic year
     * @return Pricebook2 record
     */
    private static Pricebook2 getOrCreateClassPriceBook(String priceBookName, String academicYearId) {
        // Check if price book already exists for this class and year
        List<Pricebook2> existingPriceBooks = [
            SELECT Id, Name, IsActive
            FROM Pricebook2
            WHERE Name = :priceBookName
            AND Academic_Year__c = :academicYearId
            LIMIT 1
        ];
        
        if (!existingPriceBooks.isEmpty()) {
            System.debug('Found existing price book: ' + existingPriceBooks[0].Name);
            Pricebook2 existingPB = existingPriceBooks[0];
            if (!existingPB.IsActive) {
                existingPB.IsActive = true;
                update existingPB;
            }
            return existingPB;
        }
        
        // Create new price book for the class and year
        Pricebook2 newPriceBook = new Pricebook2();
        newPriceBook.Name = priceBookName;
        newPriceBook.Academic_Year__c = academicYearId;
        newPriceBook.IsActive = true;
        newPriceBook.Description = 'Price Book for ' + priceBookName;
        
        insert newPriceBook;
        System.debug('Created new price book: ' + newPriceBook.Name);
        
        return newPriceBook;
    }
    
    /**
     * Get Standard Price Book ID
     * @return Standard Price Book ID
     */
    private static Id getStandardPriceBookId() {
        // Try to get standard price book
        List<Pricebook2> standardPriceBooks = [
            SELECT Id 
            FROM Pricebook2 
            WHERE IsStandard = true 
            LIMIT 1
        ];
        
        if (!standardPriceBooks.isEmpty()) {
            return standardPriceBooks[0].Id;
        }
        
        // If running in test context
        if (Test.isRunningTest()) {
            return Test.getStandardPricebookId();
        }
        
        throw new AuraHandledException('Standard Price Book not found');
    }
    
    /**
     * Method to retrieve active academic years
     * @return List of active Academic_Year__c records
     */
    @AuraEnabled(cacheable=true)
    public static List<Academic_Year__c> getActiveAcademicYears() {
        return [SELECT Id, Name, Is_Active__c FROM Academic_Year__c ORDER BY Name DESC];
    }

    /**
     * Method to retrieve all Fee products
     * @return List of all Product2 records with Family = 'Fee'
     */
    @AuraEnabled
    public static List<Product2> getAllFeeProducts() {
        try {
            return [
                SELECT Id, Name, ProductCode, IsActive, Description, CreatedDate
                FROM Product2
                WHERE Family = 'Fee' AND IsActive = true
                ORDER BY CreatedDate DESC
                LIMIT 1000
            ];
        } catch (Exception e) {
            System.debug('Error retrieving products: ' + e.getMessage());
            throw new AuraHandledException('Error retrieving products: ' + e.getMessage());
        }
    }
    
    /**
     * Method to check if a product name already exists
     * @param productNames List of product names to check
     * @return Map of product name to boolean (true if exists)
     */
    @AuraEnabled
    public static Map<String, Boolean> checkProductExists(List<String> productNames) {
        try {
            Map<String, Boolean> existsMap = new Map<String, Boolean>();
            
            // Query for existing products with these names
            List<Product2> existingProducts = [
                SELECT Id, Name
                FROM Product2
                WHERE Name IN :productNames AND Family = 'Fee'
            ];
            
            // Create a set of existing product names
            Set<String> existingNames = new Set<String>();
            for (Product2 product : existingProducts) {
                existingNames.add(product.Name);
            }
            
            // Check each product name
            for (String productName : productNames) {
                existsMap.put(productName, existingNames.contains(productName));
            }
            
            return existsMap;
            
        } catch (Exception e) {
            System.debug('Error checking product existence: ' + e.getMessage());
            throw new AuraHandledException('Error checking products: ' + e.getMessage());
        }
    }
    
    /**
     * Helper method to generate product code from product name
     * @param productName The name of the product
     * @return Generated product code
     */
    private static String generateProductCode(String productName) {
        // Remove spaces and special characters, convert to uppercase
        String code = productName.replaceAll('[^a-zA-Z0-9]', '').toUpperCase();
        
        // Limit to 10 characters
        if (code.length() > 10) {
            code = code.substring(0, 10);
        }
        
        // Add timestamp to ensure uniqueness
        String timestamp = String.valueOf(System.now().getTime());
        code = code + '_' + timestamp.substring(timestamp.length() - 4);
        
        return code;
    }
  @AuraEnabled
public static List<String> getSuggestedFeeProductNames() {
    try {
        List<String> names = new List<String>();
        List<Product2> products = [
            SELECT Name 
            FROM Product2 
            WHERE Family = 'Fee' AND IsActive = true
            ORDER BY Name ASC
            LIMIT 200
        ];
        for (Product2 p : products) {
            names.add(p.Name);
        }
        return names;
    } catch (Exception e) {
        throw new AuraHandledException('Error fetching suggestions: ' + e.getMessage());
    }
}

    @AuraEnabled(cacheable=true)
    public static List<Map<String, String>> getAllPriceBooks(String academicYearId) {
        List<Map<String, String>> options = new List<Map<String, String>>();
        try {
            List<Pricebook2> pbs = [SELECT Id, Name FROM Pricebook2 WHERE IsActive = true AND Academic_Year__c = :academicYearId ORDER BY Name];
            for (Pricebook2 pb : pbs) {
                options.add(new Map<String, String>{'label' => pb.Name, 'value' => pb.Id});
            }
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
        return options;
    }
}