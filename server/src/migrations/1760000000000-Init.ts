import type { MigrationInterface, QueryRunner } from 'typeorm'

export class Init1760000000000 implements MigrationInterface {
  name = 'Init1760000000000'

  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE \`players\` (
      \`id\` int NOT NULL AUTO_INCREMENT,
      \`sub\` varchar(255) NOT NULL,
      \`username\` varchar(255) NULL,
      \`display_name\` varchar(255) NULL,
      \`email\` varchar(255) NULL,
      \`last_login_at\` datetime NULL,
      \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
      UNIQUE INDEX \`UQ_players_sub\` (\`sub\`),
      PRIMARY KEY (\`id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`)
    await q.query(`CREATE TABLE \`player_progress\` (
      \`player_id\` int NOT NULL,
      \`data\` text NOT NULL,
      \`total_score\` bigint NOT NULL DEFAULT 0,
      \`saga_stars\` int NOT NULL DEFAULT 0,
      \`gold_stars_lifetime\` int NOT NULL DEFAULT 0,
      \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
      INDEX \`IDX_progress_total_score\` (\`total_score\`),
      INDEX \`IDX_progress_saga_stars\` (\`saga_stars\`),
      INDEX \`IDX_progress_gold_lifetime\` (\`gold_stars_lifetime\`),
      PRIMARY KEY (\`player_id\`),
      CONSTRAINT \`FK_progress_player\` FOREIGN KEY (\`player_id\`) REFERENCES \`players\` (\`id\`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`)
    await q.query(`CREATE TABLE \`runs\` (
      \`id\` int NOT NULL AUTO_INCREMENT,
      \`player_id\` int NOT NULL,
      \`stage_id\` int NOT NULL,
      \`score\` int NOT NULL,
      \`won\` tinyint NOT NULL,
      \`gold_stars\` int NOT NULL,
      \`objectives\` text NOT NULL,
      \`plane_id\` varchar(32) NOT NULL,
      \`kills\` int NOT NULL DEFAULT 0,
      \`spawned\` int NOT NULL DEFAULT 0,
      \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      INDEX \`IDX_runs_player_created\` (\`player_id\`, \`created_at\`),
      PRIMARY KEY (\`id\`),
      CONSTRAINT \`FK_runs_player\` FOREIGN KEY (\`player_id\`) REFERENCES \`players\` (\`id\`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`)
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE `runs`')
    await q.query('DROP TABLE `player_progress`')
    await q.query('DROP TABLE `players`')
  }
}
