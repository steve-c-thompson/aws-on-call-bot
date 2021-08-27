import { Secret as EcsSecret } from "@aws-cdk/aws-ecs";
import { ISecret } from "@aws-cdk/aws-secretsmanager";

/** Creates a Secret Manager secret that we directly consume in ECS. */
export function newEcsSecret(secret: ISecret, name: string): EcsSecret {
  return EcsSecret.fromSecretsManager(secret, name);
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
    // -NMgAjb
    return "OncallSlackBot-test";
  }
}

export const awsInfo = new AwsInfo();
