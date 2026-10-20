package com.ct286.invoicing.user;

import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;

@Configuration
class SampleUserSeeder {
    @Bean
    @ConditionalOnProperty(name = "app.seed-users", havingValue = "true")
    ApplicationRunner seedUsers(UserService users, Environment env) {
        return args -> users.seed(env.getProperty("SAMPLE_ADMIN_PASSWORD"), env.getProperty("SAMPLE_ACCOUNTANT_PASSWORD"), env.getProperty("SAMPLE_ACCOUNTANT2_PASSWORD"));
    }
}
