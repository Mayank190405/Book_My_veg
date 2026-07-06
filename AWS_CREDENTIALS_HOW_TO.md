
# How to Generate AWS Access Keys

To provide the credentials for your new environment, follow these steps in your AWS Console:

### 1. Log in to AWS
Go to [console.aws.amazon.com](https://console.aws.amazon.com/) and sign in.

### 2. Navigate to IAM
Search for **"IAM"** in the top search bar and select the **IAM Service**.

### 3. Select (or Create) a User
- Click on **"Users"** in the left sidebar.
- Choose your existing user, or click **"Create user"**.
- *(If creating a user: Ensure you attach **"AdministratorAccess"** in the "Set permissions" step)*.

### 4. Create Access Key
- Click on the **User Name**.
- Navigate to the **"Security credentials"** tab.
- Scroll down to the **"Access keys"** section.
- Click **"Create access key"**.
- Select **"Command Line Interface (CLI)"** as the use case.
- Check the "I understand..." box and click **Next**.
- (Optional) Set a description like "BMV-Deployment".
- Click **"Create access key"**.

### 5. Capture the Credentials
- You will now see your **Access Key ID** (long string of letters/numbers) and **Secret Access Key**.
- **COPY** the Secret Key immediately (it will only be shown once).
- **Download the .csv file** as a backup.

### 6. Fill the [.env.aws](file:///c:/Users/MAYANK/OneDrive/Desktop/bmv_new/.env.aws) file:
- **AWS_ACCESS_KEY_ID**: Paste the ID from Step 5.
- **AWS_SECRET_ACCESS_KEY**: Paste the Secret Key from Step 5.
- **AWS_DEFAULT_REGION**: Choose a region (e.g., `ap-south-1` for Mumbai or `us-east-1` for N. Virginia).

---

**Once you have filled this in, save the file and let me know. I will take over the deployment from there.**
