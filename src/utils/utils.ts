import { Secret as EcsSecret } from "@aws-cdk/aws-ecs";
import { Secret as SmSecret, ISecret } from "@aws-cdk/aws-secretsmanager";
import { Construct } from "@aws-cdk/core";

/** Creates a Secret Manager secret that we directly consume in ECS. */
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
