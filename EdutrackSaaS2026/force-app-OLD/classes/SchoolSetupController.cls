public with sharing class SchoolSetupController {
    
    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getSetup() {
        try {
            School_Setup__c setup = School_Setup__c.getOrgDefaults();
            // Explicitly map fields to avoid issues with JSON serialization stripping namespaced fields
            Map<String, Object> result = new Map<String, Object>();
            result.put('School_Name__c', setup.School_Name__c);
            result.put('School_Address__c', setup.School_Address__c);
            result.put('School_Email__c', setup.School_Email__c);
            result.put('School_Phone__c', setup.School_Phone__c);
            result.put('School_Logo__c', setup.School_Logo__c);
            result.put('School_Subtitle__c', setup.School_Subtitle__c);
            result.put('PhonePe_ID__c', setup.PhonePe_ID__c);
            result.put('GooglePay_ID__c', setup.GooglePay_ID__c);
            result.put('UPI_QR_ID__c', setup.UPI_QR_ID__c);
            result.put('Bank_Name__c', setup.Bank_Name__c);
            result.put('Bank_IFSC__c', setup.Bank_IFSC__c);
            result.put('Bank_Account_Number__c', setup.Bank_Account_Number__c);
            result.put('Bank_Branch__c', setup.Bank_Branch__c);
            result.put('Setup_Completed__c', setup.Setup_Completed__c);
            return result;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled
    public static void saveSetup(Map<String, Object> setupData) {
        try {
            School_Setup__c setup = School_Setup__c.getOrgDefaults();
            
            setup.School_Name__c = (String)setupData.get('schoolName');
            setup.School_Address__c = (String)setupData.get('schoolAddress');
            setup.School_Email__c = (String)setupData.get('schoolEmail');
            setup.School_Phone__c = (String)setupData.get('schoolPhone');
            setup.School_Logo__c = (String)setupData.get('schoolLogo');
            setup.School_Subtitle__c = (String)setupData.get('schoolSubtitle');
            
            // New Payment Config Fields
            setup.PhonePe_ID__c = (String)setupData.get('phonePeId');
            setup.GooglePay_ID__c = (String)setupData.get('googlePayId');
            setup.UPI_QR_ID__c = (String)setupData.get('upiQrId');
            setup.Bank_Name__c = (String)setupData.get('bankName');
            setup.Bank_IFSC__c = (String)setupData.get('bankIfsc');
            setup.Bank_Account_Number__c = (String)setupData.get('bankAccountNumber');
            setup.Bank_Branch__c = (String)setupData.get('bankBranch');

            setup.Setup_Completed__c = true;
            
            upsert setup;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled
    public static List<Map<String, Object>> getBankAccounts() {
        try {
            List<School_Bank_Account__c> accounts = [SELECT Id, Name, Bank_Name__c, IFSC_Code__c, 
                                                    Account_Number__c, Branch__c, Is_Primary__c 
                                                    FROM School_Bank_Account__c 
                                                    ORDER BY Is_Primary__c DESC, Name ASC];
            List<Map<String, Object>> result = new List<Map<String, Object>>();
            for(School_Bank_Account__c acc : accounts) {
                result.add(NamespaceUtils.stripNamespace(acc));
            }
            return result;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled
    public static void saveBankAccounts(List<Map<String, Object>> accountsData, List<Id> deleteIds) {
        try {
            if (deleteIds != null && !deleteIds.isEmpty()) {
                delete [SELECT Id FROM School_Bank_Account__c WHERE Id IN :deleteIds];
            }
            
            List<School_Bank_Account__c> toUpsert = new List<School_Bank_Account__c>();
            List<Id> existingIds = new List<Id>();
            
            for(Map<String, Object> data : accountsData) {
                School_Bank_Account__c acc = new School_Bank_Account__c();
                if(data.get('Id') != null) {
                    acc.Id = (Id)data.get('Id');
                    existingIds.add(acc.Id);
                }
                acc.Name = (String)data.get('Name');
                acc.Bank_Name__c = (String)data.get('Bank_Name__c');
                acc.IFSC_Code__c = (String)data.get('IFSC_Code__c');
                acc.Account_Number__c = (String)data.get('Account_Number__c');
                acc.Branch__c = (String)data.get('Branch__c');
                acc.Is_Primary__c = (Boolean)data.get('Is_Primary__c');
                toUpsert.add(acc);
            }
            
            // Delete accounts not in the provided list (if we want to sync)
            // For now, let's just upsert what we have. 
            // Better: get all current accounts for the school (if we had a School ID)
            // Since this is a global school setup, we can delete others if needed.
            if(!toUpsert.isEmpty()) {
                upsert toUpsert;
            }
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled
    public static String uploadLogo(String base64Data, String fileName) {
        try {
            ContentVersion cv = new ContentVersion();
            cv.Title = fileName;
            cv.PathOnClient = fileName;
            cv.VersionData = EncodingUtil.base64Decode(base64Data);
            cv.IsMajorVersion = true;
            insert cv;

            ContentVersion insertedCV = [SELECT Id FROM ContentVersion WHERE Id = :cv.Id LIMIT 1];
            // Returns the ID so we can generate the URL for the Custom Setting
            return insertedCV.Id;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }
    @AuraEnabled(cacheable=true)
    public static List<Map<String, Object>> getAcademicYears() {
        try {
            List<Academic_Year__c> years = [SELECT Id, Name, Start_Date__c, End_Date__c, Is_Active__c 
                                           FROM Academic_Year__c 
                                           ORDER BY Start_Date__c DESC];
            return NamespaceUtils.stripNamespaceList(years);
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    @AuraEnabled
    public static void saveAcademicYear(String yearRange, Boolean isActive) {
        try {
            String cleanYearRange = yearRange.replace('–', '-');
            List<String> years = cleanYearRange.split('-');
            if (years.size() != 2) throw new AuraHandledException('Invalid year range format.');
            
            Integer startYear = Integer.valueOf(years[0].trim());
            Integer endYear = Integer.valueOf(years[1].trim());
            
            // Academic Year: June 1st to May 31st
            Date startDate = Date.newInstance(startYear, 6, 1);
            Date endDate = Date.newInstance(endYear, 5, 31);
            
            // Check if record already exists
            List<Academic_Year__c> existing = [SELECT Id FROM Academic_Year__c WHERE Name = :cleanYearRange LIMIT 1];
            Academic_Year__c ay = existing.isEmpty() ? new Academic_Year__c() : existing[0];
            
            ay.Name = cleanYearRange;
            ay.Start_Date__c = startDate;
            ay.End_Date__c = endDate;
            ay.Is_Active__c = isActive;
            
            if (isActive) {
                // Allow up to 2 active years. Deactivate oldest if exceeding limit.
                List<Academic_Year__c> others = [SELECT Id, Is_Active__c FROM Academic_Year__c WHERE Is_Active__c = true AND Id != :ay.Id ORDER BY Start_Date__c ASC];
                if (others.size() >= 2) {
                    others[0].Is_Active__c = false;
                    update others[0];
                }
            }
            
            upsert ay;
        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }
}