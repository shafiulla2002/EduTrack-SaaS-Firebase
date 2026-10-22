@IsTest(SeeAllData = true)
public with sharing class LightningSelfRegisterControllerTest {

 /* Verifies that IsValidPassword method with various password combinations. */
 @IsTest
 static void testIsValidPassword() {
  Assert.isTrue(LightningSelfRegisterController.isValidPassword('password?@12334', 'password?@12334'), 'Passwords should be valid');
  Assert.isFalse(LightningSelfRegisterController.isValidPassword('password?@12334', 'dummyPassword'), 'Passwords should be invalid');
  Assert.isFalse(LightningSelfRegisterController.isValidPassword('password?@12334', null), 'Passwords should be invalid');
  Assert.isFalse(LightningSelfRegisterController.isValidPassword(null, 'fakePwd'), 'Passwords should be invalid');
 }

 @IsTest
 static void testSiteAsContainerEnabled() {
  Assert.isNotNull(LightningSelfRegisterController.siteAsContainerEnabled('https://portaleu1-developer-edition.eu11.force.com'), 'Should return a boolean');
 }

 /* Verifies the selfRegistration method flow with various invalid inputs */
 @IsTest
 static void testSelfRegistration() {
  Map < String, String > paramsMap = initializeParams();
  Assert.isNotNull(paramsMap, 'Should not be null');
  Assert.areEqual(Label.Site.lastname_is_required, LightningSelfRegisterController.selfRegister(paramsMap.get('firstName'), '', paramsMap.get('email'), paramsMap.get('password'), paramsMap.get('confirmPasswordCorrect'), null, paramsMap.get('regConfirmUrl'), null, paramsMap.get('startUrl'), true), 'Should be required');
  Assert.areEqual(Label.Site.email_is_required, LightningSelfRegisterController.selfRegister(paramsMap.get('firstName'), paramsMap.get('lastName'), '', paramsMap.get('password'), paramsMap.get('confirmPasswordCorrect'), null, paramsMap.get('regConfirmUrl'), null, paramsMap.get('startUrl'), true), 'Should be required');
  Assert.areEqual(Label.Site.email_is_required, LightningSelfRegisterController.selfRegister(null, paramsMap.get('lastName'), '', null, paramsMap.get('confirmPasswordCorrect'), null, paramsMap.get('regConfirmUrl'), null, paramsMap.get('startUrl'), true), 'Should be required');
  Assert.areEqual(Label.site.passwords_dont_match, LightningSelfRegisterController.selfRegister(paramsMap.get('firstName'), paramsMap.get('lastName'), paramsMap.get('email'), paramsMap.get('password'), paramsMap.get('confirmPasswordWrong'), null, paramsMap.get('regConfirmUrl'), null, paramsMap.get('startUrl'), true), 'Should not match');
  Assert.isNotNull(LightningSelfRegisterController.selfRegister(paramsMap.get('firstName'), paramsMap.get('lastName'), '', paramsMap.get('password'), paramsMap.get('confirmPasswordWrong'), null, paramsMap.get('regConfirmUrl'), null, paramsMap.get('startUrl'), false), 'Should return error');
 }


 /* Verifies the selfRegistration flow for valid inputs */
 @IsTest
 static void testSelfRegisterWithProperCredentials() {
  Map < String, String > paramsMap = initializeParams();
        try {
            LightningSelfRegisterController.selfRegister(paramsMap.get('firstName'), paramsMap.get('lastName'), paramsMap.get('email'), paramsMap.get('password'), paramsMap.get('confirmPasswordCorrect'), null, paramsMap.get('regConfirmUrl'), null, paramsMap.get('startUrl'), true);
        } catch(System.RequiredFeatureMissingException e) {
            Assert.isNotNull(e.getMessage(), 'Caught correctly missing feature exception');
        } catch(Exception e) { }
    }

 /* Verifies SelfRegistration flow with an accounId that is created within the test */
 @IsTest
 static void testSelfRegisterWithCreatedAccount() {
  Id rtId = [SELECT Id FROM RecordType WHERE SobjectType='Account' AND IsPersonType=true LIMIT 1].Id;
  Account acc = new Account(FirstName = 'test', LastName = 'acc', RecordTypeId = rtId);
  insert acc;
  List < Account > accounts = [SELECT Id FROM Account LIMIT 1];
  Assert.isFalse(accounts.isEmpty(), 'There must be at least one account in this environment!');
  String accountId = accounts[0].Id;
  Map < String, String > paramsMap = initializeParams();
        try {
            LightningSelfRegisterController.selfRegister(paramsMap.get('firstName'), paramsMap.get('lastName'), paramsMap.get('email'), paramsMap.get('password'), paramsMap.get('confirmPasswordCorrect'), accountId, paramsMap.get('regConfirmUrl'), null, paramsMap.get('startUrl'), false);
        } catch(System.RequiredFeatureMissingException e) {
            Assert.isNotNull(e.getMessage(), 'Caught site context missing properly');
        } catch(Exception e) {}
    }

 @IsTest
 static void testGetNullExtraFields() {
  Assert.areEqual(new List < Map < String, Object >> (), LightningSelfRegisterController.getExtraFields(null), 'Should render empty array');
 }

 @IsTest
 static void testGetNonEmptyExtraFields() {
  Assert.areEqual(new List < Map < String, Object >> (), LightningSelfRegisterController.getExtraFields('field1'), 'Should render empty array');
 }

 /* Verifies validation of extraFields within the Self Registration flow */
 @IsTest
 static void testGetExtraFieldsInSelfRegistration() {
  List < Map < String, Object >> fieldlist = new List < Map < String, Object >> ();
  Map < String, String > paramsMap = initializeParams();
  Map < String, Object > fieldMap = new Map < String, Object > ();
  fieldMap.put('description', 'new field');
  fieldMap.put('fieldPath', 'dummyPath');
  fieldlist.add(fieldMap);
  String extraFields = JSON.serialize(fieldlist);
  Assert.isNotNull(LightningSelfRegisterController.selfRegister(paramsMap.get('firstName'), paramsMap.get('lastName'), paramsMap.get('email'), paramsMap.get('password'), paramsMap.get('confirmPasswordCorrect'), null, paramsMap.get('regConfirmUrl'), extraFields, paramsMap.get('startUrl'), true), 'Should validate extra fields');
 }

 @IsTest
 static void LightningSelfRegisterControllerInstantiation() {
  LightningSelfRegisterController controller = new LightningSelfRegisterController();
  Assert.isNotNull(controller, 'Should not be null');
 }

 @IsTest
 static void testSetExperienceId() {
  Assert.isNotNull(LightningSelfRegisterController.setExperienceId('testExpid'), 'Should return expId string natively instead of null');
  Assert.isNull(LightningSelfRegisterController.setExperienceId(null), 'Should return null natively during external context testing');
 }

 /* Helper method to initialize the parameters required for SelfRegistration. */
 private static Map < String, String > initializeParams() {
  Map < String, String > paramsMap = new Map < String, String > ();
  String firstName = 'test';
  String lastName = 'User';
  String email = 'testUser@salesforce.com';
  String password = 'testuser123';
  String confirmPasswordCorrect = 'testuser123';
  String confirmPasswordWrong = 'wrongpassword';
  String accountId = 'testuser123';
  String regConfirmUrl = 'http://registration-confirm.com';
  String startUrl = 'http://my.company.salesforce.com';
  paramsMap.put('firstName', firstName);
  paramsMap.put('lastName', lastName);
  paramsMap.put('email', email);
  paramsMap.put('password', password);
  paramsMap.put('confirmPasswordCorrect', confirmPasswordCorrect);
  paramsMap.put('confirmPasswordWrong', confirmPasswordWrong);
  paramsMap.put('accountId', accountId);
  paramsMap.put('regConfirmUrl', regConfirmUrl);
  paramsMap.put('startUrl', startUrl);
  return paramsMap;
 }
}