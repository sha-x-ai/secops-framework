# Azure Onboarding Deep Dive

This document contains deep dives into various aspects and troubleshooting scenarios for Azure manual onboarding into Cortex Cloud.

## Azure Manual Onboarding Phase 5 Error

Phase 5 of the Azure manual onboarding process is **"Complete the Azure onboarding wizard in Cortex."** After provisioning Azure resources (Phases 1-4), users must return to Cortex to input their Azure IDs, either manually or by uploading an `azure-identifiers.json` file. 

### Key Findings & Known Errors

1. **Phase 5 API Registration Blocker:** 
   According to internal field assessment trackers, completing Phase 5 registration via API may require Professional Services (PS) intervention, as it involves manual Azure onboarding with minimal permissions.

2. **Error 5: InvalidActionOrNotAction (Deprecated Action):**
   Although labeled as "Error 5" in the Azure Onboarding Troubleshooting Guide rather than strictly a Phase 5 error, deployments can fail with an `InvalidActionOrNotAction` message. This occurs when a template includes a deprecated action or un-registered providers. Azure Resource Manager (ARM) rejects the deployment with a generic failure. 
   * **Troubleshooting:** The engineering team is aware, and standard workarounds involve removing the deprecated action or ensuring providers are registered.

3. **Managed Identity / Authorization Failures:**
   When attempting to finalize onboarding or execute policy remediation, you may encounter `AuthorizationFailed` or `ResourceGroupNotFound` errors. 
   * **Troubleshooting:** This often happens due to timing issues. Allow 5-10 minutes for newly created managed identities to propagate across Azure before re-running the script or finalizing the setup in the Cortex wizard. Ensure the identity has the correct Entra ID and Azure RBAC roles assigned.

4. **Data Entry Errors in Cortex Wizard:**
   If an error is displayed after clicking Save in the Phase 5 wizard, verify that the fields in the Global Identifiers and Managed Identity sections are populated correctly (e.g., Tenant ID, Client ID, Subscription ID) and try saving again.


---

## Azure Manual Onboarding Identifiers JSON

The **identifiers JSON file** is a customized configuration document used to track service accounts and organization-specific metadata when manually onboarding a Microsoft Azure environment into Cortex Cloud or XSIAM.

### Overview
- **Generation (Phase 1)**: The file is generated and downloaded via the Cortex onboarding wizard during the initial setup.
- **File Structure**:
  1. `"identifiers"`: Pre-populated by the wizard with details generated specifically for the environment.
  2. `"manual_details"`: A template section that must be manually populated by the user with actual values from the Azure environment (e.g., Tenant ID, Management Group ID, Subscription ID).
- **Completion (Phase 5)**: 
  - **Automated Upload**: Users can populate the `"manual_details"` section in a local text editor, then drag and drop the JSON file directly into the Cortex wizard to automatically fill all required fields.
  - **Manual Configuration**: Alternatively, users can manually copy the Azure IDs from their environment into the corresponding text fields.

### Troubleshooting
- **Mismatched Identifiers**: Deployment failures often occur if the `Object ID` and `Application (Client) ID` in Azure Entra ID do not exactly match the `customer_object_id` and `outpost_client_id` variables in the `parameters.sh` or `template.json` files.


---

## Azure Onboarding Wizard Manual Connection Failed

When encountering manual connection failures, issues typically revolve around permissions, token expiration, replication delays, and configuration mismatches.

### 1. Authentication and Permissions Issues
*   **AuthorizationFailed**: The user account lacks necessary permissions at the management group level. **Resolution:** Elevate access to the root management group in Entra ID properties and assign Owner and User Access Administrator roles. Refresh credentials.
*   **InvalidAuthenticationToken**: Azure Cloud Shell sessions active for over 1.5 hours can expire the token. **Resolution:** Run `az login` to refresh.
*   **Insufficient privileges (Graph API)**: The identity lacks administrative rights in Entra ID. **Resolution:** Assign a built-in Entra ID role like Application Administrator.

### 2. Missing Identifiers and Replication Delays
*   **PrincipalNotFound**: The Cortex Enterprise Application is not yet created, Object/Client IDs mismatch, or there is a replication delay. **Resolution:** Verify the application exists in Entra ID. Wait 2–10 minutes for object replication.

### 3. Policy and Compliance Blocking
*   **RequestDisallowedByPolicy**: Resource creation is disallowed because mandatory tags are missing. **Resolution:** Modify the script to explicitly pass required tags (`--tags`).


---

## Azure Cloud Instance Pending Manual Onboarding

A **pending cloud instance** is generated when you complete the onboarding wizard and click Save. Cortex creates an authentication template (Terraform or ARM) based on the configurations for this pending instance.

### Steps for Manual Onboarding
1. Run the downloaded authentication template (Terraform or ARM) within your Azure environment.
2. In Cortex Cloud, navigate to **Cloud Instances** (remove default filters to see pending instances).
3. Right-click the pending instance and choose **Manually connect an instance**.
4. Map the outputs from your Azure deployment to the necessary input fields in Cortex to finalize the connection.

Pending instances are automatically deleted after 30 days and can be used to create multiple instances sharing the same configuration.


---

## Azure Audit Logs Event Hub Consumer Group Cortex Cloud Onboarding

Cortex Cloud supports ingesting Azure audit logs via Microsoft Azure Event Hubs. 

### Configuration Options
1. **Automated Collection**: Cortex automatically provisions the Azure infrastructure (Event Hub, consumer group, UAMI).
2. **Custom Collection**: Route logs to an existing Event Hub to avoid duplicate costs. Cortex provisions a **dedicated consumer group** on the existing Event Hub. *Limitation: The existing Event Hub must reside in the exact same Azure subscription being onboarded.*

### Required Parameters
Users must provide the Event Hub Namespace, Event Hub Name, **Consumer Group Name** (do not use `$Default`), and Storage Account Connection String/Name.

### Required Permissions
The UAMI needs **Azure Event Hubs Data Receiver** on the namespace and **Storage Blob Data Contributor** on the storage account.


---

## Azure Onboarding Permissions Health Missing Permissions Cortex Cloud

Frequent errors relate to missing permissions because the subscription lacks roles, providers are unregistered, or scripts fail to create assignments.

### Manually Remediating Missing Permissions
If you encounter missing permissions after onboarding (e.g., in the Permissions health status), there is a known issue (CRTX-232818). To manually trigger a remediation task:
1. Navigate to the **Management Group** in Azure Portal.
2. Go to **Governance > Policy** and click **Compliance**.
3. Search for your Cortex Resources Policy (filter by the last five digits of your tenant's `LCAAS_ID`).
4. If **Non-compliant**, click the policy name, click **Create remediation task**, and click **Remediate**.

### Best Practices
*   Ensure **Owner** role at the tenant root and **Global Admin** permissions before starting.
*   Wait 2-10 minutes after applying role changes for Azure AD to replicate.
*   Run `az login` to refresh credentials before executing templates.
