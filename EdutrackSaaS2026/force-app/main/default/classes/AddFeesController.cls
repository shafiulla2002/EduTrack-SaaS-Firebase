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
                if (!Schema.sObjectType.Product2.isCreateable()) {
                    throw new AuraHandledException('Insufficient permissions to create products.');
                }
                SObjectAccessDecision decision = Security.stripInaccessible(AccessType.CREATABLE, productsToInsert);
                insert decision.getRecords();
                return (List<Product2>) decision.getRecords();
            }
            
            return new List<Product2>();
            
        } catch (Exception e) {
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
            
            if (String.isBlank(academicYearId)) {
                return priceMap;
            }

            Id targetPriceBookId = null;
            if (String.isNotBlank(priceBookId)) {
                targetPriceBookId = priceBookId;
            } else {
                // Convert "Class-1" to "Class 1" for Pricebook lookup
                String classBaseName = className != null ? className.replace('-', ' ') : '';
                // Find the price book for this class and specific year
                List<Pricebook2> priceBooks = (List<Pricebook2>)Security.stripInaccessible(AccessType.READABLE, [SELECT Id, Name
                    FROM Pricebook2
                    WHERE Academic_Year__c = :academicYearId
                    AND Name LIKE :classBaseName + '%'
                    LIMIT 1]).getRecords();
                if (!priceBooks.isEmpty()) {
                    targetPriceBookId = priceBooks[0].Id;
                }
            }
            
            if (targetPriceBookId == null) {
                return priceMap;
            }
            
            Id finalPriceBookId = targetPriceBookId;
            
            // Get all price book entries for this price book
            List<PricebookEntry> entries = (List<PricebookEntry>)Security.stripInaccessible(AccessType.READABLE, [SELECT Id, Product2Id, UnitPrice, IsActive
                FROM PricebookEntry
                WHERE Pricebook2Id = :finalPriceBookId
                AND IsActive = true
                ]).getRecords();
            
            // Build map of Product ID to Price
            for (PricebookEntry entry : entries) {
                priceMap.put(entry.Product2Id, entry.UnitPrice);
            }
            return priceMap;
        } catch (Exception e) {
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
            if (String.isBlank(academicYearId)) {
                throw new AuraHandledException('Academic Year is required.');
            }

            List<Academic_Year__c> ays = [SELECT Name FROM Academic_Year__c WHERE Id = :academicYearId WITH SECURITY_ENFORCED LIMIT 1];
            if (ays.isEmpty()) throw new AuraHandledException('Academic Year not found.');
            Academic_Year__c ay = ays[0];
            
            Map<String, Object> result = new Map<String, Object>();
            
            // Convert "Class-1" to "Class 1" for Pricebook lookup
            String classBaseName = className.replace('-', ' ');
            String priceBookName = classBaseName + ' - ' + ay.Name;

            // Get or create custom Price Book for the class and year
            Pricebook2 classPriceBook = getOrCreateClassPriceBook(priceBookName, academicYearId);
            
            // Get Standard Price Book ID
            Id standardPriceBookId = getStandardPriceBookId();
            
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
                
                if (String.isNotBlank(productIdStr) && price != null && price > 0) {
                    productIds.add(productIdStr);
                    productPriceMap.put(productIdStr, price);
                }
            }
            
            // Check which products already have standard price book entries
            List<PricebookEntry> existingStandardEntries = [SELECT Id, Product2Id, Pricebook2Id, UnitPrice
                FROM PricebookEntry
                WHERE Product2Id IN :productIds 
                AND Pricebook2Id = :standardPriceBookId
                WITH SECURITY_ENFORCED
                ];
            
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
                    }
                }
            }
            
            // Insert new standard entries
            if (!standardEntriesToCreate.isEmpty()) {
                if (!Schema.sObjectType.PricebookEntry.isCreateable()) {
                    throw new AuraHandledException('Insufficient permissions to create price book entries.');
                }
                SObjectAccessDecision decision = Security.stripInaccessible(AccessType.CREATABLE, standardEntriesToCreate);
                insert decision.getRecords();
            }
            
            // Update existing standard entries
            if (!entriesToUpdate.isEmpty()) {
                if (!Schema.sObjectType.PricebookEntry.isUpdateable()) {
                    throw new AuraHandledException('Insufficient permissions to update price book entries.');
                }
                SObjectAccessDecision decision = Security.stripInaccessible(AccessType.UPDATABLE, entriesToUpdate);
                update decision.getRecords();
            }
            
            // Check for existing custom price book entries for this class
            List<PricebookEntry> existingCustomEntries = (List<PricebookEntry>)Security.stripInaccessible(AccessType.READABLE, [SELECT Id, Product2Id, UnitPrice
                FROM PricebookEntry
                WHERE Product2Id IN :productIds 
                AND Pricebook2Id = :classPriceBook.Id
                ]).getRecords();
            
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
                    }
                }
            }
            
            // Insert new custom entries
            if (!customEntriesToCreate.isEmpty()) {
                if (!Schema.sObjectType.PricebookEntry.isCreateable()) {
                    throw new AuraHandledException('Insufficient permissions to create price book entries.');
                }
                SObjectAccessDecision decision = Security.stripInaccessible(AccessType.CREATABLE, customEntriesToCreate);
                insert decision.getRecords();
            }
            
            // Update existing custom entries
            if (!customEntriesToUpdate.isEmpty()) {
                if (!Schema.sObjectType.PricebookEntry.isUpdateable()) {
                    throw new AuraHandledException('Insufficient permissions to update price book entries.');
                }
                SObjectAccessDecision decision = Security.stripInaccessible(AccessType.UPDATABLE, customEntriesToUpdate);
                update decision.getRecords();
            }
            
            Integer totalEntries = customEntriesToCreate.size() + customEntriesToUpdate.size();
            
            // Prepare result
            result.put('success', true);
            result.put('priceBookId', classPriceBook.Id);
            result.put('priceBookName', classPriceBook.Name);
            result.put('entriesCreated', totalEntries);
            result.put('message', 'Successfully processed ' + totalEntries + ' price book entries for ' + className);
            
            return result;
            
        } catch (Exception e) {
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
        List<Pricebook2> existingPriceBooks = [SELECT Id, Name, IsActive
            FROM Pricebook2
            WHERE Name = :priceBookName
            AND Academic_Year__c = :academicYearId
            WITH SECURITY_ENFORCED
            LIMIT 1];
        
        if (!existingPriceBooks.isEmpty()) {
            Pricebook2 existingPB = existingPriceBooks[0];
            if (!existingPB.IsActive) {
                existingPB.IsActive = true;
                if (!Schema.sObjectType.Pricebook2.isUpdateable()) {
                    throw new AuraHandledException('Insufficient permissions to update price books.');
                }
                SObjectAccessDecision decision = Security.stripInaccessible(AccessType.UPDATABLE, new List<Pricebook2>{existingPB});
                update decision.getRecords();
            }
            return existingPB;
        }
        
        // Create new price book for the class and year
        Pricebook2 newPriceBook = new Pricebook2();
        newPriceBook.Name = priceBookName;
        newPriceBook.Academic_Year__c = academicYearId;
        newPriceBook.IsActive = true;
        newPriceBook.Description = 'Price Book for ' + priceBookName;
        
        if (!Schema.sObjectType.Pricebook2.isCreateable()) {
            throw new AuraHandledException('Insufficient permissions to create price books.');
        }
        SObjectAccessDecision decision = Security.stripInaccessible(AccessType.CREATABLE, new List<Pricebook2>{newPriceBook});
        insert decision.getRecords();
        Pricebook2 insertedPB = (Pricebook2) decision.getRecords()[0];
        
        return insertedPB;
    }
    
    /**
     * Get Standard Price Book ID
     * @return Standard Price Book ID
     */
    private static Id getStandardPriceBookId() {
        // Try to get standard price book
        List<Pricebook2> standardPriceBooks = [SELECT Id 
            FROM Pricebook2 
            WHERE IsStandard = true
            WITH SECURITY_ENFORCED
            LIMIT 1];
        
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
    @AuraEnabled
    public static List<Academic_Year__c> getActiveAcademicYears() {
        return (List<Academic_Year__c>) Security.stripInaccessible(
            AccessType.READABLE,
            [SELECT Id, Name, Is_Active__c FROM Academic_Year__c WHERE Is_Active__c = true ORDER BY Name DESC LIMIT 100]
        ).getRecords();
    }

    /**
     * Method to retrieve all Fee products
     * @return List of all Product2 records with Family = 'Fee'
     */
    @AuraEnabled
    public static List<Product2> getAllFeeProducts() {
        try {
            return (List<Product2>) Security.stripInaccessible(
                AccessType.READABLE,
                [SELECT Id, Name, ProductCode, IsActive, Description, CreatedDate
                 FROM Product2
                 WHERE Family = 'Fee' AND IsActive = true
                 ORDER BY CreatedDate DESC LIMIT 1000]
            ).getRecords();
        } catch (Exception e) {
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
            List<Product2> existingProducts = (List<Product2>) Security.stripInaccessible(
                AccessType.READABLE,
                [SELECT Id, Name FROM Product2 WHERE Name IN :productNames AND Family = 'Fee']
            ).getRecords();
            
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
        List<Product2> products = (List<Product2>) Security.stripInaccessible(
            AccessType.READABLE,
            [SELECT Name FROM Product2 WHERE Family = 'Fee' AND IsActive = true ORDER BY Name ASC LIMIT 200]
        ).getRecords();
        for (Product2 p : products) {
            names.add(p.Name);
        }
        return names;
    } catch (Exception e) {
        throw new AuraHandledException('Error fetching suggestions: ' + e.getMessage());
    }
}

    @AuraEnabled
    public static List<Map<String, String>> getAllPriceBooks(String academicYearId) {
        List<Map<String, String>> options = new List<Map<String, String>>();
        try {
            List<Pricebook2> pbs = (List<Pricebook2>) Security.stripInaccessible(
                AccessType.READABLE,
                [SELECT Id, Name FROM Pricebook2 WHERE IsActive = true AND Academic_Year__c = :academicYearId ORDER BY Name LIMIT 1000]
            ).getRecords();
            for (Pricebook2 pb : pbs) {
                options.add(new Map<String, String>{'label' => pb.Name, 'value' => pb.Id});
            }
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
        return options;
    }
    @AuraEnabled
public static List<Map<String, String>> getClassOptions() {
    List<Map<String, String>> options = new List<Map<String, String>>();
    try {
        options.add(new Map<String, String>{'label' => 'Choose a class...', 'value' => ''});
        List<Class__c> classes = (List<Class__c>) Security.stripInaccessible(
            AccessType.READABLE,
            [SELECT Id, Name FROM Class__c ORDER BY Name ASC LIMIT 200]
        ).getRecords();
        for (Class__c cls : classes) {
            options.add(new Map<String, String>{
                'label' => cls.Name, 
                'value' => cls.Name
            });
        }
    } catch (Exception e) {
        throw new AuraHandledException('Error fetching classes: ' + e.getMessage());
    }
    return options;
}
}






