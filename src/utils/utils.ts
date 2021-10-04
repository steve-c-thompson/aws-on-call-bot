import { Secret, Secret as EcsSecret } from "@aws-cdk/aws-ecs";
import { Secret as SmSecret, ISecret } from "@aws-cdk/aws-secretsmanager";
import { Construct, Stack } from "@aws-cdk/core";
import { Vpc } from "@aws-cdk/aws-ec2";
import * as ec2 from "@aws-cdk/aws-ec2";
import * as iam from "@aws-cdk/aws-iam";

/** Creates a Secret Manager secret that we directly consume in ECS. */
export function newEcsSecret2(stack: Stack, name: string): EcsSecret {
  return EcsSecret.fromSecretsManager(
    new SmSecret(stack, name, { secretName: name })
  );
}
export function buildSecrets2(stack: Stack) {
  const secrets: Record<string, Secret> = {
    SLACK_SIGNING_SECRET: newEcsSecret2(stack, awsInfo.getSecretName()),
    SLACK_BOT_TOKEN: newEcsSecret2(stack, awsInfo.getSecretName()),
    GOOGLE_SERVICE_ACCOUNT_EMAIL: newEcsSecret2(stack, awsInfo.getSecretName()),
    GOOGLE_PRIVATE_KEY: newEcsSecret2(stack, awsInfo.getSecretName()),
    SLACK_GOOGLE_SHEET_ID: newEcsSecret2(stack, awsInfo.getSecretName()),
  };
  return secrets;
}

export function newEcsSecret(secret: ISecret, name: string): EcsSecret {
  return EcsSecret.fromSecretsManager(secret, name);
}

export function smSecretFromName(
  scope: Construct,
  id: string,
  secretName: string
): ISecret {
  return SmSecret.fromSecretNameV2(scope, id, secretName);
}

export function buildPublicVpc(scope: Construct, name: string): Vpc {
  return new ec2.Vpc(scope, name, {
    natGateways: 1,
    maxAzs: 1,
    // subnetConfiguration: [
    //   {
    //     cidrMask: 24,
    //     name: "public",
    //     subnetType: ec2.SubnetType.PUBLIC,
    //   },
    // ],
    // enableDnsSupport: true,
    // enableDnsHostnames: true,
  });
}

// export function buildSecrets2(scope: Construct) {
//   let secretStr, decodedBinarySecret;
//   const client = new SecretsManager({
//     region: awsInfo.getRegion(),
//   });
//   client.getSecretValue(
//     { SecretId: awsInfo.getSecretName() },
//     function (err, data) {
//       if (err) {
//         if (err.code === "DecryptionFailureException")
//           // Secrets Manager can't decrypt the protected secret text using the provided KMS key.
//           // Deal with the exception here, and/or rethrow at your discretion.
//           throw err;
//         else if (err.code === "InternalServiceErrorException")
//           // An error occurred on the server side.
//           // Deal with the exception here, and/or rethrow at your discretion.
//           throw err;
//         else if (err.code === "InvalidParameterException")
//           // You provided an invalid value for a parameter.
//           // Deal with the exception here, and/or rethrow at your discretion.
//           throw err;
//         else if (err.code === "InvalidRequestException")
//           // You provided a parameter value that is not valid for the current state of the resource.
//           // Deal with the exception here, and/or rethrow at your discretion.
//           throw err;
//         else if (err.code === "ResourceNotFoundException")
//           // We can't find the resource that you asked for.
//           // Deal with the exception here, and/or rethrow at your discretion.
//           throw err;
//       } else {
//         // Decrypts secret using the associated KMS CMK.
//         // Depending on whether the secret is a string or binary, one of these fields will be populated.
//         if ("SecretString" in data) {
//           secretStr = data.SecretString;
//         } else {
//           let buff = new Buffer(data.SecretBinary as string, "base64");
//           secretStr = buff.toString("ascii");
//         }
//       }
//
//       // Your code goes here.
//     }
//   );
// }
export function buildSecrets(scope: Construct) {
  const secret = smSecretFromName(
    scope,
    "oncall-bot-secret",
    awsInfo.getSecretName()
  );

  const role = new iam.Role(scope, "OncallSecretReader", {
    assumedBy: new iam.AccountRootPrincipal(),
  });
  secret.grantRead(role);

  const secrets: Record<string, Secret> = {
    SLACK_SIGNING_SECRET: newEcsSecret(secret, "SLACK_SIGNING_SECRET"),
    SLACK_BOT_TOKEN: newEcsSecret(secret, "SLACK_BOT_TOKEN"),
    GOOGLE_SERVICE_ACCOUNT_EMAIL: newEcsSecret(
      secret,
      "GOOGLE_SERVICE_ACCOUNT_EMAIL"
    ),
    GOOGLE_PRIVATE_KEY: newEcsSecret(secret, "GOOGLE_PRIVATE_KEY"),
    SLACK_GOOGLE_SHEET_ID: newEcsSecret(secret, "SLACK_GOOGLE_SHEET_ID"),
  };
  return secrets;
}

class AwsInfo {
  //arn:aws:secretsmanager:us-east-2:146543024844:secret:OncallSlackBot-test-NMgAjb
  getAccountNumber(): string {
    return process.env.CDK_DEFAULT_ACCOUNT || "146543024844";
  }

  getRegion(): string {
    return process.env.CDK_DEFAULT_REGION || "us-east-2";
  }

  getSlackBotSecretArn(): string {
    return (
      "arn:aws:secretsmanager:" +
      this.getRegion() +
      ":" +
      this.getAccountNumber() +
      ":secret:" +
      this.getSecretName()
    );
  }

  getSecretName(): string {
    return "OncallSlackBot-test"; // -NMgAjb
  }
}

export const awsInfo = new AwsInfo();
