import { Secret, Secret as EcsSecret } from "@aws-cdk/aws-ecs";
import { Secret as SmSecret, ISecret } from "@aws-cdk/aws-secretsmanager";
import { Construct } from "@aws-cdk/core";
import { Vpc } from "@aws-cdk/aws-ec2";
import * as ec2 from "@aws-cdk/aws-ec2";
import * as iam from "@aws-cdk/aws-iam";

/** Creates a Secret Manager secret that we directly consume in ECS. */
export function newEcsSecret(secret: ISecret, name: string): EcsSecret {
  const s = EcsSecret.fromSecretsManager(secret, name);
  return s;
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
    natGateways: 0,
    subnetConfiguration: [
      {
        cidrMask: 24,
        name: "public",
        subnetType: ec2.SubnetType.PUBLIC,
      },
    ],
    enableDnsSupport: true,
    enableDnsHostnames: true,
  });
}

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
