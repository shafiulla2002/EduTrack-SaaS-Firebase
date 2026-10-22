@isTest
public class AddFeesControllerTest {
    @testSetup
    static void setup() {
        Academic_Year__c ay = new Academic_Year__c(Name = '2024-2025', Is_Active__c = true, Start_Date__c = Date.today(), End_Date__c = Date.today().addYears(1));
        insert ay;
        
        // Pre-create standard pricebook id (creates standard if doesn't exist)
        Id stdPbId = Test.getStandardPricebookId();
    }
    
    @isTest
    static void testCreateFeeProducts() {
        List<String> productNames = new List<String>{'Tuition Fee', 'Transport Fee'};
        Test.startTest();
        List<Product2> products = AddFeesController.createFeeProducts(productNames);
        Test.stopTest();
        
        Assert.areEqual(2, products.size(), 'Should create 2 products');
        Assert.isNotNull(products[0].ProductCode, 'Product code should be generated');
        
        // Test exception
        try {
            AddFeesController.createFeeProducts(null);
            Assert.fail('Should have thrown an exception');
        } catch(Exception e) {
            Assert.isNotNull(e.getMessage(), 'Exception message should be populated');
        }
    }
    
    @isTest
    static void testGetExistingPrices() {
        Academic_Year__c ay = [SELECT Id FROM Academic_Year__c LIMIT 1];
        
        Product2 prod = new Product2(Name='Test Fee', Family='Fee', IsActive=true);
        insert prod;
        Id stdPbId = Test.getStandardPricebookId();
        PricebookEntry pbEntryStd = new PricebookEntry(Pricebook2Id=stdPbId, Product2Id=prod.Id, UnitPrice=100, IsActive=true);
        insert pbEntryStd;
        
        Pricebook2 customPb = new Pricebook2(Name='Class 1 - 2024-2025', Academic_Year__c=ay.Id, IsActive=true);
        insert customPb;
        PricebookEntry pbEntryCust = new PricebookEntry(Pricebook2Id=customPb.Id, Product2Id=prod.Id, UnitPrice=150, IsActive=true);
        insert pbEntryCust;
        
        Test.startTest();
        Map<String, Decimal> prices = AddFeesController.getExistingPrices('Class-1', ay.Id, customPb.Id);
        Test.stopTest();
        
        Assert.isTrue(prices.containsKey(prod.Id), 'Should contain the product');
        Assert.areEqual(150, prices.get(prod.Id), 'Price should be 150');
        
        Map<String, Decimal> emptyPrices = AddFeesController.getExistingPrices('Class-1', null, null);
        Assert.isTrue(emptyPrices.isEmpty(), 'Should return empty map');
    }
    
    @isTest
    static void testCreatePriceBookEntries() {
        Academic_Year__c ay = [SELECT Id FROM Academic_Year__c LIMIT 1];
        Product2 prod1 = new Product2(Name='Fee 1', Family='Fee', IsActive=true);
        Product2 prod2 = new Product2(Name='Fee 2', Family='Fee', IsActive=true);
        insert new List<Product2>{prod1, prod2};
        
        List<Map<String, Object>> priceData = new List<Map<String, Object>>();
        priceData.add(new Map<String, Object>{'productId' => prod1.Id, 'price' => 100});
        priceData.add(new Map<String, Object>{'productId' => prod2.Id, 'price' => '200'}); 
        
        Test.startTest();
        Map<String, Object> result = AddFeesController.createPriceBookEntries('Class-1', ay.Id, priceData);
        priceData[0].put('price', 150);
        AddFeesController.createPriceBookEntries('Class-1', ay.Id, priceData);
        Test.stopTest();
        
        Assert.isTrue((Boolean)result.get('success'), 'Should be successful');
        
        try {
            AddFeesController.createPriceBookEntries('Class-1', null, priceData);
            Assert.fail('Should have thrown an exception');
        } catch(AuraHandledException e) {
            Assert.isNotNull(e.getMessage(), 'Exception should be populated');
        }
    }
    
    @isTest
    static void testGetActiveAcademicYears() {
        List<Academic_Year__c> years = AddFeesController.getActiveAcademicYears();
        Assert.areEqual(1, years.size(), 'Should return 1 year');
    }
    
    @isTest
    static void testGetAllFeeProducts() {
        Product2 prod = new Product2(Name='Fee 1', Family='Fee', IsActive=true);
        insert prod;
        List<Product2> prods = AddFeesController.getAllFeeProducts();
        Assert.isTrue(prods.size() > 0, 'Should return at least 1 product');
    }
    
    @isTest
    static void testCheckProductExists() {
        Product2 prod = new Product2(Name='Existing Fee', Family='Fee', IsActive=true);
        insert prod;
        
        Map<String, Boolean> result = AddFeesController.checkProductExists(new List<String>{'Existing Fee', 'New Fee'});
        Assert.isTrue(result.get('Existing Fee'), 'Should exist');
        Assert.isFalse(result.get('New Fee'), 'Should not exist');
    }
}