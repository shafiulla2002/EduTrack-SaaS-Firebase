public without sharing class NamingHelper {
    public static String getAcademicYearName(String academicYearId) {
        if (String.isBlank(academicYearId)) {
            return '';
        }
        
        String trimmedId = academicYearId.trim();
        List<Academic_Year__c> records = [SELECT Name FROM Academic_Year__c WHERE Id = :trimmedId LIMIT 1];
        
        if (!records.isEmpty()) {
            return records[0].Name;
        }
        
        return trimmedId;
    }
}